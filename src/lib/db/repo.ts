import { getSqlClient, type SqlClient } from "@/lib/db/sql";
import { env } from "@/lib/env";
import {
  type DraftSlide,
  type FitMode,
  type Practice,
  type PracticeWithSlides,
  type PublishedSnapshot,
  type ScheduleRepeat,
  type SlideKind,
  type SlideshowSettings,
  type TextSlideContent,
  type VideoSlideContent,
  normaliseRepeat,
  normaliseSettings,
} from "@/lib/types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS practices (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  published_json TEXT,
  published_version INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slides (
  id TEXT PRIMARY KEY,
  practice_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  original_key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  caption TEXT,
  duration_ms INTEGER,
  fit TEXT,
  text_json TEXT,
  video_json TEXT,
  start_at TEXT,
  end_at TEXT,
  schedule_repeat TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_slides_practice ON slides (practice_id, position);

CREATE TABLE IF NOT EXISTS published_versions (
  practice_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  PRIMARY KEY (practice_id, version)
);

`;

// Columns added after the initial release; brought up to date on existing
// databases (the CREATE TABLE above already includes them for fresh installs).
type ColumnSpec = { name: string; ddl: string };

const SLIDE_COLUMNS: ColumnSpec[] = [
  { name: "kind", ddl: "kind TEXT NOT NULL DEFAULT 'image'" },
  { name: "text_json", ddl: "text_json TEXT" },
  { name: "video_json", ddl: "video_json TEXT" },
  { name: "start_at", ddl: "start_at TEXT" },
  { name: "end_at", ddl: "end_at TEXT" },
  { name: "schedule_repeat", ddl: "schedule_repeat TEXT" },
];

async function ensureColumns(
  c: SqlClient,
  table: string,
  columns: ColumnSpec[],
): Promise<void> {
  if (env.databaseDriver === "postgres") {
    for (const col of columns) {
      await c.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col.ddl}`);
    }
    return;
  }
  // SQLite has no ADD COLUMN IF NOT EXISTS — inspect the table first.
  const info = await c.all<{ name: string }>(`PRAGMA table_info(${table})`);
  const have = new Set(info.map((r) => r.name));
  for (const col of columns) {
    if (!have.has(col.name)) {
      await c.exec(`ALTER TABLE ${table} ADD COLUMN ${col.ddl}`);
    }
  }
}

let initPromise: Promise<SqlClient> | null = null;

/** Ensure the schema exists and is migrated, returning a ready SQL client. */
function db(): Promise<SqlClient> {
  if (!initPromise) {
    const client = getSqlClient();
    initPromise = client
      .exec(SCHEMA)
      .then(() => ensureColumns(client, "slides", SLIDE_COLUMNS))
      .then(() => client)
      .catch((err) => {
        // Try again on the next request: a long-running server would otherwise
        // stay broken after one failure (the database briefly unreachable, or
        // another instance creating the same tables at the same moment).
        initPromise = null;
        throw err;
      });
  }
  return initPromise;
}

/** Health check: the database answers and its schema is ready. */
export async function pingDatabase(): Promise<void> {
  const c = await db();
  await c.get("SELECT 1 AS ok");
}

// ---------------------------------------------------------------------------
// Row shapes & mappers
// ---------------------------------------------------------------------------

interface PracticeRow {
  id: string;
  slug: string;
  name: string;
  settings_json: string;
  published_json: string | null;
  published_version: number;
  published_at: string | null;
  dirty: number;
  created_at: string;
  updated_at: string;
}

interface SlideRow {
  id: string;
  practice_id: string;
  position: number;
  kind: string | null;
  original_key: string;
  width: number;
  height: number;
  caption: string | null;
  duration_ms: number | null;
  fit: string | null;
  text_json: string | null;
  video_json: string | null;
  start_at: string | null;
  end_at: string | null;
  schedule_repeat: string | null;
  created_at: string;
}

function mapPractice(row: PracticeRow): Practice {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    settings: normaliseSettings(safeParse<SlideshowSettings>(row.settings_json)),
    publishedVersion: row.published_version,
    publishedAt: row.published_at,
    hasUnpublishedChanges: row.dirty === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSlide(row: SlideRow): DraftSlide {
  return {
    id: row.id,
    position: row.position,
    kind: (row.kind as SlideKind) ?? "image",
    originalKey: row.original_key,
    width: row.width,
    height: row.height,
    caption: row.caption,
    durationMs: row.duration_ms,
    fit: (row.fit as FitMode | null) ?? null,
    text: safeParse<TextSlideContent>(row.text_json),
    video: safeParse<VideoSlideContent>(row.video_json),
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    repeat: normaliseRepeat(row.schedule_repeat),
    createdAt: row.created_at,
  };
}

function safeParse<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Practices
// ---------------------------------------------------------------------------

export async function listPractices(): Promise<Practice[]> {
  const c = await db();
  // LOWER() works in both SQLite and Postgres (avoids SQLite-only COLLATE).
  const rows = await c.all<PracticeRow>(
    "SELECT * FROM practices ORDER BY LOWER(name)",
  );
  return rows.map(mapPractice);
}

export async function getPracticeBySlug(slug: string): Promise<Practice | undefined> {
  const c = await db();
  const row = await c.get<PracticeRow>(
    "SELECT * FROM practices WHERE slug = ?",
    [slug],
  );
  return row ? mapPractice(row) : undefined;
}

export async function getPracticeWithSlides(
  slug: string,
): Promise<PracticeWithSlides | undefined> {
  const practice = await getPracticeBySlug(slug);
  if (!practice) return undefined;
  const slides = await getSlides(practice.id);
  return { ...practice, slides };
}

export async function createPractice(input: {
  id: string;
  slug: string;
  name: string;
  settings: SlideshowSettings;
}): Promise<Practice> {
  const c = await db();
  const ts = now();
  await c.run(
    `INSERT INTO practices (id, slug, name, settings_json, published_version, dirty, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
    [input.id, input.slug, input.name, JSON.stringify(input.settings), ts, ts],
  );
  const created = await getPracticeBySlug(input.slug);
  return created!;
}

export async function updatePractice(
  id: string,
  changes: { name?: string; settings?: SlideshowSettings },
  opts: { markDirty?: boolean } = {},
): Promise<void> {
  const c = await db();
  // Saving settings that didn't change shouldn't flag "unpublished changes",
  // so callers can opt out of the dirty marker.
  const dirtySql = (opts.markDirty ?? true) ? ", dirty = 1" : "";
  if (changes.name !== undefined) {
    await c.run(
      `UPDATE practices SET name = ?, updated_at = ?${dirtySql} WHERE id = ?`,
      [changes.name, now(), id],
    );
  }
  if (changes.settings !== undefined) {
    await c.run(
      `UPDATE practices SET settings_json = ?, updated_at = ?${dirtySql} WHERE id = ?`,
      [JSON.stringify(changes.settings), now(), id],
    );
  }
}

/** Flag the draft as having changes not yet published. */
export async function markDirty(id: string): Promise<void> {
  const c = await db();
  await c.run("UPDATE practices SET dirty = 1, updated_at = ? WHERE id = ?", [
    now(),
    id,
  ]);
}

export async function deletePractice(id: string): Promise<void> {
  const c = await db();
  await c.run("DELETE FROM slides WHERE practice_id = ?", [id]);
  await c.run("DELETE FROM published_versions WHERE practice_id = ?", [id]);
  await c.run("DELETE FROM practices WHERE id = ?", [id]);
}

export async function setPublished(
  id: string,
  snapshot: PublishedSnapshot,
): Promise<void> {
  const c = await db();
  const json = JSON.stringify(snapshot);
  await c.run(
    `UPDATE practices
       SET published_json = ?, published_version = ?, published_at = ?, dirty = 0, updated_at = ?
     WHERE id = ?`,
    [json, snapshot.version, snapshot.publishedAt, now(), id],
  );
  // Record this version (older ones are pruned in lib/publish).
  await c.run(
    `INSERT INTO published_versions (practice_id, version, snapshot_json, published_at)
     VALUES (?, ?, ?, ?)`,
    [id, snapshot.version, json, snapshot.publishedAt],
  );
}

/** Delete recorded versions at or below the given version number. */
export async function pruneVersionRows(
  practiceId: string,
  maxVersion: number,
): Promise<void> {
  const c = await db();
  await c.run("DELETE FROM published_versions WHERE practice_id = ? AND version <= ?", [
    practiceId,
    maxVersion,
  ]);
}

export async function unpublish(id: string): Promise<void> {
  const c = await db();
  await c.run(
    "UPDATE practices SET published_json = NULL, dirty = 1, updated_at = ? WHERE id = ?",
    [now(), id],
  );
}

export async function getPublishedSnapshot(
  slug: string,
): Promise<PublishedSnapshot | undefined> {
  const c = await db();
  const row = await c.get<{ published_json: string | null }>(
    "SELECT published_json FROM practices WHERE slug = ?",
    [slug],
  );
  if (!row) return undefined;
  const snapshot = safeParse<PublishedSnapshot>(row.published_json);
  return snapshot ?? undefined;
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

export async function getSlides(practiceId: string): Promise<DraftSlide[]> {
  const c = await db();
  const rows = await c.all<SlideRow>(
    "SELECT * FROM slides WHERE practice_id = ? ORDER BY position ASC",
    [practiceId],
  );
  return rows.map(mapSlide);
}

async function nextPosition(c: SqlClient, practiceId: string): Promise<number> {
  const max = await c.get<{ m: number | null }>(
    "SELECT MAX(position) AS m FROM slides WHERE practice_id = ?",
    [practiceId],
  );
  return (max?.m ?? -1) + 1;
}

export async function addSlide(input: {
  id: string;
  practiceId: string;
  originalKey: string;
  width: number;
  height: number;
}): Promise<DraftSlide> {
  const c = await db();
  const position = await nextPosition(c, input.practiceId);
  await c.run(
    `INSERT INTO slides (id, practice_id, position, kind, original_key, width, height, created_at)
     VALUES (?, ?, ?, 'image', ?, ?, ?, ?)`,
    [
      input.id,
      input.practiceId,
      position,
      input.originalKey,
      input.width,
      input.height,
      now(),
    ],
  );
  await markDirty(input.practiceId);
  const row = await c.get<SlideRow>("SELECT * FROM slides WHERE id = ?", [input.id]);
  return mapSlide(row!);
}

export async function addTextSlide(input: {
  id: string;
  practiceId: string;
  text: TextSlideContent;
  durationMs?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  repeat?: ScheduleRepeat | null;
}): Promise<DraftSlide> {
  const c = await db();
  const position = await nextPosition(c, input.practiceId);
  await c.run(
    `INSERT INTO slides (id, practice_id, position, kind, original_key, width, height, text_json, duration_ms, start_at, end_at, schedule_repeat, created_at)
     VALUES (?, ?, ?, 'text', '', 0, 0, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.practiceId,
      position,
      JSON.stringify(input.text),
      input.durationMs ?? null,
      input.startAt ?? null,
      input.endAt ?? null,
      input.repeat ?? "none",
      now(),
    ],
  );
  await markDirty(input.practiceId);
  const row = await c.get<SlideRow>("SELECT * FROM slides WHERE id = ?", [input.id]);
  return mapSlide(row!);
}

export async function addVideoSlide(input: {
  id: string;
  practiceId: string;
  video: VideoSlideContent;
  durationMs?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  repeat?: ScheduleRepeat | null;
}): Promise<DraftSlide> {
  const c = await db();
  const position = await nextPosition(c, input.practiceId);
  await c.run(
    `INSERT INTO slides (id, practice_id, position, kind, original_key, width, height, video_json, duration_ms, start_at, end_at, schedule_repeat, created_at)
     VALUES (?, ?, ?, 'video', '', 0, 0, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.practiceId,
      position,
      JSON.stringify(input.video),
      input.durationMs ?? null,
      input.startAt ?? null,
      input.endAt ?? null,
      input.repeat ?? "none",
      now(),
    ],
  );
  await markDirty(input.practiceId);
  const row = await c.get<SlideRow>("SELECT * FROM slides WHERE id = ?", [input.id]);
  return mapSlide(row!);
}

export async function getSlide(id: string): Promise<DraftSlide | undefined> {
  const c = await db();
  const row = await c.get<SlideRow>("SELECT * FROM slides WHERE id = ?", [id]);
  return row ? mapSlide(row) : undefined;
}

export async function getSlideOwned(
  id: string,
  practiceId: string,
): Promise<DraftSlide | undefined> {
  const c = await db();
  const row = await c.get<SlideRow>(
    "SELECT * FROM slides WHERE id = ? AND practice_id = ?",
    [id, practiceId],
  );
  return row ? mapSlide(row) : undefined;
}

/** Duplicate a slide's fields into a new row positioned right after it. */
export async function insertSlideAfter(input: {
  source: DraftSlide;
  practiceId: string;
  newId: string;
  newOriginalKey: string;
}): Promise<DraftSlide> {
  const c = await db();
  const { source, practiceId, newId, newOriginalKey } = input;
  const pos = source.position + 1;
  await c.run(
    "UPDATE slides SET position = position + 1 WHERE practice_id = ? AND position >= ?",
    [practiceId, pos],
  );
  await insertSlideRow(c, { source, practiceId, position: pos, newId, newOriginalKey });
  await markDirty(practiceId);
  const row = await c.get<SlideRow>("SELECT * FROM slides WHERE id = ?", [newId]);
  return mapSlide(row!);
}

/** Write a copy of a slide's fields as a new row at the given position. */
async function insertSlideRow(
  c: SqlClient,
  input: {
    source: DraftSlide;
    practiceId: string;
    position: number;
    newId: string;
    newOriginalKey: string;
  },
): Promise<void> {
  const { source } = input;
  await c.run(
    `INSERT INTO slides (id, practice_id, position, kind, original_key, width, height, caption, duration_ms, fit, text_json, video_json, start_at, end_at, schedule_repeat, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.newId,
      input.practiceId,
      input.position,
      source.kind,
      input.newOriginalKey,
      source.width,
      source.height,
      source.caption,
      source.durationMs,
      source.fit,
      source.text ? JSON.stringify(source.text) : null,
      source.video ? JSON.stringify(source.video) : null,
      source.startAt,
      source.endAt,
      source.repeat,
      now(),
    ],
  );
}

export async function updateSlide(
  id: string,
  practiceId: string,
  changes: {
    caption?: string | null;
    durationMs?: number | null;
    fit?: FitMode | null;
    text?: TextSlideContent | null;
    video?: VideoSlideContent | null;
    startAt?: string | null;
    endAt?: string | null;
    repeat?: ScheduleRepeat;
  },
): Promise<void> {
  const c = await db();
  const set = async (col: string, value: unknown) =>
    c.run(`UPDATE slides SET ${col} = ? WHERE id = ? AND practice_id = ?`, [
      value,
      id,
      practiceId,
    ]);

  if (changes.caption !== undefined) await set("caption", changes.caption);
  if (changes.durationMs !== undefined) await set("duration_ms", changes.durationMs);
  if (changes.fit !== undefined) await set("fit", changes.fit);
  if (changes.text !== undefined)
    await set("text_json", changes.text ? JSON.stringify(changes.text) : null);
  if (changes.video !== undefined)
    await set("video_json", changes.video ? JSON.stringify(changes.video) : null);
  if (changes.startAt !== undefined) await set("start_at", changes.startAt);
  if (changes.endAt !== undefined) await set("end_at", changes.endAt);
  if (changes.repeat !== undefined) await set("schedule_repeat", changes.repeat);

  await markDirty(practiceId);
}

export async function deleteSlide(id: string, practiceId: string): Promise<void> {
  const c = await db();
  await c.run("DELETE FROM slides WHERE id = ? AND practice_id = ?", [id, practiceId]);
  await markDirty(practiceId);
}

export async function reorderSlides(
  practiceId: string,
  orderedIds: string[],
): Promise<void> {
  const c = await db();
  for (let i = 0; i < orderedIds.length; i++) {
    await c.run("UPDATE slides SET position = ? WHERE id = ? AND practice_id = ?", [
      i,
      orderedIds[i],
      practiceId,
    ]);
  }
  await markDirty(practiceId);
}
