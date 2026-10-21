/**
 * Shared domain types for SurgeryScreen Lite.
 *
 * One deployment runs one waiting-room display: a slideshow, managed by a
 * single admin, published to its public URL: /{slug}
 */

export type AspectRatio = "16:9" | "4:3" | "9:16";
export type FitMode = "contain" | "cover";
export type TransitionType = "fade" | "slide" | "none";
export type SlideKind = "image" | "text" | "video";

export type LogoCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type LogoPosition = "none" | LogoCorner;
export type TextAlign = "left" | "center" | "right";

/** How a slide's schedule window repeats ("none" = shown once). */
export type ScheduleRepeat = "none" | "weekly" | "monthly" | "yearly";

/** Content of a slide composed in-app (no uploaded image). */
export interface TextSlideContent {
  heading: string;
  body: string;
  align: TextAlign;
  textColor: string;
  backgroundColor: string;
  /** Where to place the NHS logo, if anywhere. */
  nhsLogo: LogoPosition;
  /** Where to place the practice's uploaded logo, if anywhere. */
  practiceLogo: LogoPosition;
}

/**
 * Content of a video slide. The video is streamed straight from `url` (a
 * direct .mp4/.webm link — NHS campaign assets, or anything the practice
 * hosts); nothing is uploaded or stored by the app.
 */
export interface VideoSlideContent {
  /** Direct https URL to a video file. */
  url: string;
  /** Optional direct https image shown while the video is loading or unavailable. */
  poster?: string;
  /** Short label shown in the editor (not on the display). */
  title: string;
  /** Play the audio track (kiosk browser must allow autoplay with sound). */
  sound: boolean;
}

export type WidgetLayout = "floating" | "bar";

/** Live overlay widgets (clock / date / weather) shown on the display. */
export interface WidgetSettings {
  enabled: boolean;
  clock: boolean;
  date: boolean;
  weather: boolean;
  weatherLatitude: number | null;
  weatherLongitude: number | null;
  weatherLabel: string;
  /** Today's pollen level (uses the weather location). */
  pollen: boolean;
  /** Current air quality (uses the weather location). */
  airQuality: boolean;
  /** "bar" reserves a strip so it never covers slide content; "floating" overlays a corner. */
  layout: WidgetLayout;
  barPosition: "top" | "bottom";
  floatingCorner: LogoCorner;
  /** Bar/chip background colour. */
  backgroundColor: string;
  textColor: string;
  /** Background opacity (0 = transparent, 1 = solid). */
  opacity: number;
}

/** Optional circular countdown ring showing time left on the current slide. */
export interface ProgressTimerSettings {
  enabled: boolean;
  position: LogoCorner;
  color: string;
}

/** Global slideshow settings (apply to every slide unless overridden). */
export interface SlideshowSettings {
  /** Target television aspect ratio slides are normalised to on publish. */
  aspectRatio: AspectRatio;
  /** Default time each slide is shown, in milliseconds. */
  defaultDurationMs: number;
  /** How slides transition from one to the next. */
  transition: TransitionType;
  /** Transition duration, in milliseconds. */
  transitionMs: number;
  /** How each image fills the slide canvas. */
  fit: FitMode;
  /** Letterbox / canvas background colour (hex). */
  backgroundColor: string;
  /** Randomise slide order on each loop. */
  shuffle: boolean;
  /** Loop back to the first slide after the last. */
  loop: boolean;
  /** @deprecated superseded by `widgets`. Kept for older saved data. */
  showClock: boolean;
  /** Live overlay widgets. */
  widgets: WidgetSettings;
  /** Circular countdown ring for the current slide. */
  progressTimer: ProgressTimerSettings;
  /** Blob key of the practice's uploaded logo (used on text slides). */
  logoKey: string | null;
}

/** A slide in the draft (editable) slideshow. */
export interface DraftSlide {
  id: string;
  position: number;
  kind: SlideKind;
  /** Blob key of the uploaded original (image slides only; "" for text). */
  originalKey: string;
  width: number;
  height: number;
  caption: string | null;
  /** Per-slide duration override (ms). Null = use the global default. */
  durationMs: number | null;
  /** Per-slide fit override. Null = use the global fit. */
  fit: FitMode | null;
  /** Text content for kind === "text" slides. */
  text: TextSlideContent | null;
  /** Video content for kind === "video" slides. */
  video: VideoSlideContent | null;
  /** Optional schedule window (ISO datetimes). Null = always eligible. */
  startAt: string | null;
  endAt: string | null;
  /** Repeat the schedule window every week / month / year. */
  repeat: ScheduleRepeat;
  createdAt: string;
}

/** A practice and its draft slideshow configuration. */
export interface Practice {
  id: string;
  slug: string;
  name: string;
  settings: SlideshowSettings;
  publishedVersion: number;
  publishedAt: string | null;
  /** True when the draft has changes not yet published. */
  hasUnpublishedChanges: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A practice plus its draft slides (for the editor). */
export interface PracticeWithSlides extends Practice {
  slides: DraftSlide[];
}

/** A single slide in a published snapshot. */
export interface PublishedSlide {
  id: string;
  kind: SlideKind;
  /** Stable media URL for the normalised image (image slides only). */
  url: string | null;
  text: TextSlideContent | null;
  video?: VideoSlideContent | null;
  /** Time on screen. For video slides, 0 = play once through, then advance. */
  durationMs: number;
  caption: string | null;
  startAt: string | null;
  endAt: string | null;
  /** Absent in snapshots published before repeating schedules. */
  repeat?: ScheduleRepeat;
}

/**
 * Immutable snapshot served at the public URL. Devices poll for changes to
 * `version` and swap content in place when it increases.
 */
export interface PublishedSnapshot {
  slug: string;
  name: string;
  version: number;
  publishedAt: string;
  /** Normalised canvas dimensions. */
  width: number;
  height: number;
  transition: TransitionType;
  transitionMs: number;
  backgroundColor: string;
  shuffle: boolean;
  loop: boolean;
  showClock: boolean;
  widgets: WidgetSettings;
  progressTimer: ProgressTimerSettings;
  /** Media URL for the practice logo, if set (used by text slides). */
  practiceLogoUrl: string | null;
  slides: PublishedSlide[];
}

export const DEFAULT_WIDGETS: WidgetSettings = {
  enabled: false,
  clock: true,
  date: true,
  weather: false,
  weatherLatitude: null,
  weatherLongitude: null,
  weatherLabel: "",
  pollen: false,
  airQuality: false,
  layout: "bar",
  barPosition: "bottom",
  floatingCorner: "top-right",
  backgroundColor: "#005EB8",
  textColor: "#ffffff",
  opacity: 0.85,
};

export const DEFAULT_PROGRESS_TIMER: ProgressTimerSettings = {
  enabled: false,
  position: "bottom-right",
  color: "#ffffff",
};

export const DEFAULT_TEXT_SLIDE: TextSlideContent = {
  heading: "",
  body: "",
  align: "center",
  textColor: "#ffffff",
  backgroundColor: "#005EB8",
  nhsLogo: "none",
  practiceLogo: "none",
};

export const DEFAULT_SETTINGS: SlideshowSettings = {
  aspectRatio: "16:9",
  defaultDurationMs: 8000,
  transition: "fade",
  transitionMs: 800,
  fit: "contain",
  backgroundColor: "#000000",
  shuffle: false,
  loop: true,
  showClock: false,
  widgets: DEFAULT_WIDGETS,
  progressTimer: DEFAULT_PROGRESS_TIMER,
  logoKey: null,
};

/** Pixel dimensions slides are normalised to for each aspect ratio. */
export const ASPECT_DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "4:3": { w: 1440, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
};

/** Coerce arbitrary stored JSON into a complete, valid settings object. */
export function normaliseSettings(
  raw:
    | (Omit<Partial<SlideshowSettings>, "widgets"> & {
        widgets?: Partial<WidgetSettings>;
      })
    | null
    | undefined,
): SlideshowSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(raw ?? {}),
    widgets: { ...DEFAULT_WIDGETS, ...(raw?.widgets ?? {}) },
    progressTimer: { ...DEFAULT_PROGRESS_TIMER, ...(raw?.progressTimer ?? {}) },
  };
}

export const SCHEDULE_REPEATS: ScheduleRepeat[] = ["none", "weekly", "monthly", "yearly"];

/** Coerce a stored repeat value (older rows have none). */
export function normaliseRepeat(value: unknown): ScheduleRepeat {
  return SCHEDULE_REPEATS.includes(value as ScheduleRepeat) ? (value as ScheduleRepeat) : "none";
}

type Period = Exclude<ScheduleRepeat, "none">;

/**
 * `date` moved on by `n` weeks / months / years, in local time. Month-end
 * dates are clamped (31 Jan + 1 month = 28/29 Feb), so "whole month" windows
 * stay inside their month.
 */
function shiftDate(date: Date, period: Period, n: number): number {
  const d = new Date(date.getTime());
  if (period === "weekly") {
    d.setDate(d.getDate() + 7 * n);
    return d.getTime();
  }
  const target = d.getMonth() + (period === "yearly" ? 12 * n : n);
  const year = d.getFullYear() + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  d.setFullYear(year, month, Math.min(d.getDate(), lastDay));
  return d.getTime();
}

/** Is `now` inside the [start, end] window or any later repeat of it? */
function inRepeatingWindow(start: Date, end: Date, period: Period, now: number): boolean {
  if (now < start.getTime()) return false;
  const current = new Date(now);
  // Roughly how many periods have passed; its neighbours cover windows that
  // straddle a boundary (e.g. 20 Dec – 5 Jan) and clock changes.
  const estimate =
    period === "weekly"
      ? Math.floor((now - start.getTime()) / (7 * 86_400_000))
      : period === "monthly"
        ? (current.getFullYear() - start.getFullYear()) * 12 +
          (current.getMonth() - start.getMonth())
        : current.getFullYear() - start.getFullYear();
  for (let n = estimate + 1; n >= Math.max(0, estimate - 1); n--) {
    if (shiftDate(start, period, n) <= now && now <= shiftDate(end, period, n)) return true;
  }
  return false;
}

/** Is a slide eligible to show at the given time, per its schedule window? */
export function isSlideScheduledNow(
  slide: { startAt: string | null; endAt: string | null; repeat?: ScheduleRepeat | null },
  now: number = Date.now(),
): boolean {
  const parse = (v: string | null) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };
  const start = parse(slide.startAt);
  const end = parse(slide.endAt);

  // Repeating needs a complete window; without one it behaves as a one-off.
  if (slide.repeat && slide.repeat !== "none" && start && end && end > start) {
    return inRepeatingWindow(start, end, slide.repeat, now);
  }
  if (start && now < start.getTime()) return false;
  if (end && now > end.getTime()) return false;
  return true;
}
