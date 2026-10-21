"use client";

import { useState } from "react";
import { CheckCircle2, Film, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScheduleFields } from "@/components/admin/editor/ScheduleFields";
import { api } from "@/lib/client";
import { formatDuration } from "@/lib/format";
import type { DraftSlide, ScheduleRepeat, VideoSlideContent } from "@/lib/types";

/** Result of loading the pasted link in the preview player. */
type LinkState = "idle" | "loading" | "ok" | "error";

interface FormProps {
  slug: string;
  slide: DraftSlide | null;
  onClose: () => void;
  onSaved: (slide: DraftSlide, isNew: boolean) => void;
}

function VideoForm({ slug, slide, onClose, onSaved }: FormProps) {
  const initial = slide?.video ?? null;
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sound, setSound] = useState(initial?.sound ?? false);
  // Default: play the video once through. Optional: hold the slide for a
  // fixed time instead (short videos loop to fill it).
  const [fixedTime, setFixedTime] = useState(slide?.durationMs != null);
  const [durationMs, setDurationMs] = useState(slide?.durationMs ?? 30000);
  const [startAt, setStartAt] = useState<string | null>(slide?.startAt ?? null);
  const [endAt, setEndAt] = useState<string | null>(slide?.endAt ?? null);
  const [repeat, setRepeat] = useState<ScheduleRepeat>(slide?.repeat ?? "none");
  const [saving, setSaving] = useState(false);

  // The tested link — set on "Test link", so typing doesn't reload the player
  // on every keystroke.
  const [testedUrl, setTestedUrl] = useState(initial?.url ?? "");
  const [linkState, setLinkState] = useState<LinkState>(initial?.url ? "ok" : "idle");
  const [videoSeconds, setVideoSeconds] = useState<number | null>(null);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);
  // Beyond 1080p a Raspberry Pi kiosk can't decode smoothly (and can overheat
  // or brown out trying).
  const tooLarge =
    videoSize != null && Math.max(videoSize.w, videoSize.h) > 1920;

  const trimmedUrl = url.trim();
  const looksValid = trimmedUrl.startsWith("https://");

  function testLink() {
    if (!looksValid) {
      toast.error("Paste a direct https:// link to a video file (.mp4).");
      return;
    }
    setVideoSeconds(null);
    setVideoSize(null);
    setLinkState("loading");
    setTestedUrl(trimmedUrl);
  }

  async function save() {
    if (!looksValid) {
      toast.error("Paste a direct https:// link to a video file (.mp4).");
      return;
    }
    setSaving(true);
    const video: VideoSlideContent = {
      url: trimmedUrl,
      ...(initial?.poster && trimmedUrl === initial.url ? { poster: initial.poster } : {}),
      title: title.trim() || "Video",
      sound,
    };
    const payload = {
      video,
      durationMs: fixedTime ? durationMs : null,
      startAt,
      endAt,
      repeat,
    };
    try {
      if (slide) {
        const { slide: updated } = await api<{ slide: DraftSlide }>(
          `/api/admin/practices/${slug}/slides/${slide.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        onSaved(updated, false);
      } else {
        const { slide: created } = await api<{ slide: DraftSlide }>(
          `/api/admin/practices/${slug}/slides/video`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        onSaved(created, true);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save slide.");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="v-url">Video link</Label>
          <div className="flex gap-2">
            <Input
              id="v-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (linkState !== "idle") setLinkState("idle");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  testLink();
                }
              }}
              placeholder="https://…/video.mp4"
              maxLength={600}
              spellCheck={false}
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" onClick={testLink} disabled={!looksValid}>
              Test link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A direct link to a video file (ending <code className="font-mono">.mp4</code>) — not
            a YouTube or web page link. H.264 MP4 at 1080p or below, around 3 Mbps or less
            (roughly 25 MB per minute), plays best on TV kiosks.
          </p>
        </div>

        {testedUrl && (
          <div className="space-y-1.5">
            <div className="overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "16 / 9" }}>
              <video
                key={testedUrl}
                src={testedUrl}
                controls
                muted
                preload="metadata"
                playsInline
                onLoadedMetadata={(e) => {
                  setLinkState("ok");
                  const { duration: d, videoWidth: w, videoHeight: h } = e.currentTarget;
                  setVideoSeconds(Number.isFinite(d) ? d : null);
                  setVideoSize(w && h ? { w, h } : null);
                }}
                onError={() => setLinkState("error")}
                className="h-full w-full"
              />
            </div>
            {linkState === "loading" && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading the video…
              </p>
            )}
            {linkState === "ok" && (
              <p className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="size-3.5" />
                Video loaded
                {videoSeconds != null && ` — ${formatDuration(videoSeconds * 1000)} long`}. If it
                plays here, it will play on the display.
              </p>
            )}
            {linkState === "ok" && tooLarge && videoSize && (
              <p className="flex items-start gap-1.5 text-xs text-destructive">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                This video is {videoSize.w}×{videoSize.h}{" "}— too large for a Raspberry Pi
                screen to play reliably. Use a 1080p or 720p version of it.
              </p>
            )}
            {linkState === "error" && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <XCircle className="size-3.5" />
                Couldn&apos;t play this link. It must point straight at a video file the browser
                can reach — not a web page it sits on.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="v-title">Title</Label>
          <Input
            id="v-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Shown in the editor only"
            maxLength={120}
          />
        </div>

        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Play sound</span>
            <span className="block text-xs text-muted-foreground">
              Off = silent (recommended for waiting rooms)
            </span>
          </span>
          <Switch checked={sound} onCheckedChange={setSound} />
        </label>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Fixed time on screen</span>
              <span className="block text-xs text-muted-foreground">
                Off = play the video once through, then move on
              </span>
            </span>
            <Switch checked={fixedTime} onCheckedChange={setFixedTime} />
          </label>
          {fixedTime && (
            <div className="flex items-center gap-3">
              <Slider
                min={5000}
                max={300000}
                step={1000}
                value={[durationMs]}
                onValueChange={([v]) => setDurationMs(v)}
              />
              <span className="w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {formatDuration(durationMs)}
              </span>
            </div>
          )}
        </div>
        <ScheduleFields
          startAt={startAt}
          endAt={endAt}
          repeat={repeat}
          onStartAt={setStartAt}
          onEndAt={setEndAt}
          onRepeat={setRepeat}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
          {slide ? "Save slide" : "Add slide"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function VideoSlideDialog({
  open,
  onOpenChange,
  slug,
  slide,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  slide: DraftSlide | null;
  onSaved: (slide: DraftSlide, isNew: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{slide ? "Edit video slide" : "New video slide"}</DialogTitle>
          <DialogDescription>
            Play a video streamed from a direct link — nothing is uploaded.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <VideoForm
            key={slide?.id ?? "new"}
            slug={slug}
            slide={slide}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
