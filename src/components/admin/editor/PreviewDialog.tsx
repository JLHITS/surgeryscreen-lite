"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slideshow, type ShowSlide } from "@/components/Slideshow";
import type { DraftSlide, SlideshowSettings } from "@/lib/types";

const ASPECT_CSS: Record<SlideshowSettings["aspectRatio"], string> = {
  "16:9": "16 / 9",
  "4:3": "4 / 3",
  "9:16": "9 / 16",
};

export function PreviewDialog({
  open,
  onOpenChange,
  slides,
  settings,
  practiceLogoUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: DraftSlide[];
  settings: SlideshowSettings;
  practiceLogoUrl: string | null;
}) {
  const showSlides: ShowSlide[] = slides.map((s) => ({
    id: s.id,
    kind: s.kind,
    url: s.kind === "image" ? `/api/media/${s.originalKey}` : null,
    text: s.text,
    video: s.video,
    // For video slides, no explicit duration means "play once through" (0).
    durationMs: s.durationMs ?? (s.kind === "video" ? 0 : settings.defaultDurationMs),
    caption: s.caption,
    fit: s.fit ?? settings.fit,
    startAt: s.startAt,
    endAt: s.endAt,
    repeat: s.repeat,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <div
            className="w-full overflow-hidden rounded-lg shadow-sm"
            style={{
              aspectRatio: ASPECT_CSS[settings.aspectRatio],
              maxHeight: "65vh",
              maxWidth:
                settings.aspectRatio === "9:16" ? "calc(65vh * 9 / 16)" : "100%",
            }}
          >
            {showSlides.length > 0 ? (
              <Slideshow
                slides={showSlides}
                transition={settings.transition}
                transitionMs={settings.transitionMs}
                backgroundColor={settings.backgroundColor}
                shuffle={settings.shuffle}
                loop={settings.loop}
                showClock={settings.showClock}
                widgets={settings.widgets}
                progressTimer={settings.progressTimer}
                practiceLogoUrl={practiceLogoUrl}
                ignoreSchedule
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                Add slides to preview
              </div>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Preview shows every slide (ignoring schedules). Image slides are rendered
          to a {settings.aspectRatio} canvas on publish.
        </p>
      </DialogContent>
    </Dialog>
  );
}
