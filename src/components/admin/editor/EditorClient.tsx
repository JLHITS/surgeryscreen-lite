"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Film,
  Loader2,
  Play,
  Type,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SettingsPanel } from "@/components/admin/editor/SettingsPanel";
import { Uploader } from "@/components/admin/editor/Uploader";
import { SlideGrid, type PendingUpload } from "@/components/admin/editor/SlideGrid";
import { SlideEditDialog } from "@/components/admin/editor/SlideEditDialog";
import { PreviewDialog } from "@/components/admin/editor/PreviewDialog";
import { TextSlideDialog } from "@/components/admin/editor/TextSlideDialog";
import { VideoSlideDialog } from "@/components/admin/editor/VideoSlideDialog";
import { api } from "@/lib/client";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/validation";
import type {
  DraftSlide,
  Practice,
  PracticeWithSlides,
  PublishedSnapshot,
  SlideshowSettings,
} from "@/lib/types";

export function EditorClient({
  practice,
  siteUrl,
}: {
  practice: PracticeWithSlides;
  /** Canonical base URL (SITE_URL env); "" → use the browser's origin. */
  siteUrl?: string;
}) {
  const slug = practice.slug;

  const [name, setName] = useState(practice.name);
  const savedName = useRef(practice.name);
  const [settings, setSettings] = useState<SlideshowSettings>(practice.settings);
  const [slides, setSlides] = useState<DraftSlide[]>(practice.slides);
  const [publishedVersion, setPublishedVersion] = useState(practice.publishedVersion);
  const [publishedAt, setPublishedAt] = useState(practice.publishedAt);
  const [dirty, setDirty] = useState(practice.hasUnpublishedChanges);

  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [editingSlide, setEditingSlide] = useState<DraftSlide | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [textCreateOpen, setTextCreateOpen] = useState(false);
  const [videoCreateOpen, setVideoCreateOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const practiceForBadge: Practice = {
    id: practice.id,
    slug,
    name,
    settings,
    publishedVersion,
    publishedAt,
    hasUnpublishedChanges: dirty,
    createdAt: practice.createdAt,
    updatedAt: practice.updatedAt,
  };

  function persistSettings(next: SlideshowSettings) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const { practice: saved } = await api<{ practice: PracticeWithSlides }>(
          `/api/admin/practices/${slug}`,
          {
            method: "PATCH",
            body: JSON.stringify({ settings: next }),
          },
        );
        // The server decides whether this leaves unpublished changes.
        setDirty(saved.hasUnpublishedChanges);
        setSaveState("saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save settings.");
        setSaveState("idle");
      }
    }, 600);
  }

  function onSettingsChange(next: SlideshowSettings) {
    setSettings(next);
    persistSettings(next);
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(savedName.current);
      return;
    }
    if (trimmed === savedName.current) return;
    try {
      await api(`/api/admin/practices/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      savedName.current = trimmed;
      setName(trimmed);
      setDirty(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename.");
      setName(savedName.current);
    }
  }

  async function handleFiles(files: File[]) {
    const accepted = files.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
    const skipped = files.length - accepted.length;
    if (skipped > 0) toast.error(`${skipped} file(s) skipped — unsupported type.`);

    await Promise.all(
      accepted.map(async (file) => {
        const tempId = crypto.randomUUID();
        setPending((p) => [...p, { tempId, name: file.name }]);
        try {
          const fd = new FormData();
          fd.append("file", file);
          const { slide } = await api<{ slide: DraftSlide }>(
            `/api/admin/practices/${slug}/slides`,
            { method: "POST", body: fd },
          );
          setSlides((s) => [...s, slide]);
          setDirty(true);
        } catch (err) {
          toast.error(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        } finally {
          setPending((p) => p.filter((x) => x.tempId !== tempId));
        }
      }),
    );
  }

  async function handleReorder(next: DraftSlide[]) {
    const prev = slides;
    setSlides(next);
    setDirty(true);
    try {
      await api(`/api/admin/practices/${slug}/slides/reorder`, {
        method: "POST",
        body: JSON.stringify({ orderedIds: next.map((s) => s.id) }),
      });
    } catch {
      toast.error("Could not save the new order.");
      setSlides(prev);
    }
  }

  async function handleDelete(id: string) {
    const prev = slides;
    setSlides((s) => s.filter((x) => x.id !== id));
    setDirty(true);
    try {
      await api(`/api/admin/practices/${slug}/slides/${id}`, { method: "DELETE" });
    } catch {
      toast.error("Could not delete slide.");
      setSlides(prev);
    }
  }

  function handleSlideUpdated(updated: DraftSlide) {
    setSlides((s) => s.map((x) => (x.id === updated.id ? updated : x)));
    setDirty(true);
  }

  /** A composed (text/video) slide was created or edited in a dialog. */
  function handleComposedSaved(slide: DraftSlide, isNew: boolean) {
    setSlides((s) => (isNew ? [...s, slide] : s.map((x) => (x.id === slide.id ? slide : x))));
    setDirty(true);
  }

  async function handleDuplicate(id: string) {
    try {
      const { slide } = await api<{ slide: DraftSlide }>(
        `/api/admin/practices/${slug}/slides/${id}/duplicate`,
        { method: "POST" },
      );
      setSlides((s) => {
        const i = s.findIndex((x) => x.id === id);
        if (i < 0) return [...s, slide];
        const next = [...s];
        next.splice(i + 1, 0, slide);
        return next;
      });
      setDirty(true);
      toast.success("Slide duplicated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate slide.");
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      const { snapshot } = await api<{ snapshot: PublishedSnapshot }>(
        `/api/admin/practices/${slug}/publish`,
        { method: "POST" },
      );
      setPublishedVersion(snapshot.version);
      setPublishedAt(snapshot.publishedAt);
      setDirty(false);
      toast.success(`Published v${snapshot.version} — live now`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publishing failed.");
    } finally {
      setPublishing(false);
    }
  }

  function copyUrl() {
    const url = `${siteUrl || window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Screen address copied"),
      () => toast.error("Couldn't copy"),
    );
  }

  const upToDate = publishedVersion > 0 && !dirty;
  const hasContent = slides.length > 0;
  const practiceLogoUrl = settings.logoKey ? `/api/media/${settings.logoKey}` : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button asChild variant="ghost" size="icon-sm" className="shrink-0">
          <Link href="/admin" aria-label="Back to your display">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="w-full max-w-md truncate rounded-md bg-transparent text-xl font-semibold tracking-tight outline-none hover:bg-accent/50 focus:bg-accent/50 focus:ring-2 focus:ring-ring"
            aria-label="Display name"
          />
          <button
            onClick={copyUrl}
            className="group inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="font-mono">/{slug}</span>
            <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge practice={practiceForBadge} />
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Play className="size-4" />
            Preview
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/${slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Open
            </a>
          </Button>
          <Button size="sm" onClick={publish} disabled={publishing || !hasContent || upToDate}>
            {publishing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : upToDate ? (
              <Check className="size-4" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {publishing
              ? "Publishing…"
              : upToDate
                ? "Up to date"
                : publishedVersion === 0
                  ? "Publish"
                  : "Publish changes"}
          </Button>
        </div>
      </div>

      {/* Save indicator */}
      <div className="mt-1 h-4 text-right text-xs text-muted-foreground">
        {saveState === "saving" && "Saving…"}
        {saveState === "saved" && "All changes saved"}
      </div>

      {/* Body */}
      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Add slides</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTextCreateOpen(true)}>
                <Type className="size-4" />
                Text slide
              </Button>
              <Button variant="outline" size="sm" onClick={() => setVideoCreateOpen(true)}>
                <Film className="size-4" />
                Video slide
              </Button>
            </div>
          </div>
          <Uploader onFiles={handleFiles} />
          {hasContent || pending.length > 0 ? (
            <SlideGrid
              slides={slides}
              pending={pending}
              defaultDurationMs={settings.defaultDurationMs}
              practiceLogoUrl={practiceLogoUrl}
              onReorder={handleReorder}
              onEdit={setEditingSlide}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ) : (
            <div className="rounded-lg border border-dashed py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No slides yet. Upload images, compose a text slide or add a video.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setTextCreateOpen(true)}>
                  <Type className="size-4" />
                  Text slide
                </Button>
                <Button variant="outline" size="sm" onClick={() => setVideoCreateOpen(true)}>
                  <Film className="size-4" />
                  Video slide
                </Button>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="lg:sticky lg:top-20">
            <SettingsPanel
              slug={slug}
              siteUrl={siteUrl}
              settings={settings}
              onChange={onSettingsChange}
            />
          </div>
        </div>
      </div>

      <SlideEditDialog
        slide={editingSlide?.kind === "image" ? editingSlide : null}
        slug={slug}
        defaultDurationMs={settings.defaultDurationMs}
        defaultFit={settings.fit}
        onClose={() => setEditingSlide(null)}
        onUpdated={handleSlideUpdated}
      />

      <TextSlideDialog
        open={textCreateOpen || editingSlide?.kind === "text"}
        onOpenChange={(o) => {
          if (!o) {
            setTextCreateOpen(false);
            setEditingSlide((cur) => (cur?.kind === "text" ? null : cur));
          }
        }}
        slug={slug}
        slide={editingSlide?.kind === "text" ? editingSlide : null}
        practiceLogoUrl={practiceLogoUrl}
        defaultDurationMs={settings.defaultDurationMs}
        onSaved={handleComposedSaved}
      />

      <VideoSlideDialog
        open={videoCreateOpen || editingSlide?.kind === "video"}
        onOpenChange={(o) => {
          if (!o) {
            setVideoCreateOpen(false);
            setEditingSlide((cur) => (cur?.kind === "video" ? null : cur));
          }
        }}
        slug={slug}
        slide={editingSlide?.kind === "video" ? editingSlide : null}
        onSaved={handleComposedSaved}
      />

      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        slides={slides}
        settings={settings}
        practiceLogoUrl={practiceLogoUrl}
      />

    </main>
  );
}
