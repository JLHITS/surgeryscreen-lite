"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScheduleFields } from "@/components/admin/editor/ScheduleFields";
import { api } from "@/lib/client";
import { formatDuration } from "@/lib/format";
import type { DraftSlide, FitMode, ScheduleRepeat } from "@/lib/types";

interface FormProps {
  slide: DraftSlide;
  slug: string;
  defaultDurationMs: number;
  defaultFit: FitMode;
  onClose: () => void;
  onUpdated: (slide: DraftSlide) => void;
}

function SlideForm({ slide, slug, defaultDurationMs, defaultFit, onClose, onUpdated }: FormProps) {
  const [caption, setCaption] = useState(slide.caption ?? "");
  const [customDuration, setCustomDuration] = useState(slide.durationMs != null);
  const [durationMs, setDurationMs] = useState(slide.durationMs ?? defaultDurationMs);
  const [fit, setFit] = useState<"default" | FitMode>(slide.fit ?? "default");
  const [startAt, setStartAt] = useState<string | null>(slide.startAt ?? null);
  const [endAt, setEndAt] = useState<string | null>(slide.endAt ?? null);
  const [repeat, setRepeat] = useState<ScheduleRepeat>(slide.repeat ?? "none");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const { slide: updated } = await api<{ slide: DraftSlide }>(
        `/api/admin/practices/${slug}/slides/${slide.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            caption: caption.trim() ? caption.trim() : null,
            durationMs: customDuration ? durationMs : null,
            fit: fit === "default" ? null : fit,
            startAt,
            endAt,
            repeat,
          }),
        },
      );
      onUpdated(updated);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save slide.");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/media/${slide.originalKey}`}
            alt=""
            className="mx-auto max-h-44 w-auto object-contain"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="caption">Caption</Label>
          <Textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional text shown over this slide"
            maxLength={280}
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Custom duration</span>
            <Switch checked={customDuration} onCheckedChange={setCustomDuration} />
          </label>
          {customDuration ? (
            <div className="flex items-center gap-3">
              <Slider
                min={2000}
                max={60000}
                step={500}
                value={[durationMs]}
                onValueChange={([v]) => setDurationMs(v)}
              />
              <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {formatDuration(durationMs)}
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Using the slideshow default ({formatDuration(defaultDurationMs)}).
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Image fit</Label>
          <Select value={fit} onValueChange={(v) => setFit(v as typeof fit)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                Default ({defaultFit === "contain" ? "Fit" : "Fill"})
              </SelectItem>
              <SelectItem value="contain">Fit (show whole image)</SelectItem>
              <SelectItem value="cover">Fill (crop to edges)</SelectItem>
            </SelectContent>
          </Select>
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
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save slide
        </Button>
      </DialogFooter>
    </>
  );
}

export function SlideEditDialog({
  slide,
  slug,
  defaultDurationMs,
  defaultFit,
  onClose,
  onUpdated,
}: {
  slide: DraftSlide | null;
  slug: string;
  defaultDurationMs: number;
  defaultFit: FitMode;
  onClose: () => void;
  onUpdated: (slide: DraftSlide) => void;
}) {
  return (
    <Dialog open={!!slide} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Slide options</DialogTitle>
        </DialogHeader>
        {slide && (
          <SlideForm
            key={slide.id}
            slide={slide}
            slug={slug}
            defaultDurationMs={defaultDurationMs}
            defaultFit={defaultFit}
            onClose={onClose}
            onUpdated={onUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
