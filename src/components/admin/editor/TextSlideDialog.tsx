"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TextSlideView } from "@/components/TextSlideView";
import { ScheduleFields } from "@/components/admin/editor/ScheduleFields";
import { api } from "@/lib/client";
import { formatDuration } from "@/lib/format";
import {
  DEFAULT_TEXT_SLIDE,
  type DraftSlide,
  type LogoPosition,
  type ScheduleRepeat,
  type TextAlign,
  type TextSlideContent,
} from "@/lib/types";

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-card p-1"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 font-mono text-xs uppercase"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function PositionSelect({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: LogoPosition;
  onChange: (v: LogoPosition) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as LogoPosition)} disabled={disabled}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="top-left">Top left</SelectItem>
          <SelectItem value="top-right">Top right</SelectItem>
          <SelectItem value="bottom-left">Bottom left</SelectItem>
          <SelectItem value="bottom-right">Bottom right</SelectItem>
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface FormProps {
  slug: string;
  slide: DraftSlide | null;
  practiceLogoUrl: string | null;
  defaultDurationMs: number;
  onClose: () => void;
  onSaved: (slide: DraftSlide, isNew: boolean) => void;
}

function TextForm({ slug, slide, practiceLogoUrl, defaultDurationMs, onClose, onSaved }: FormProps) {
  const initial = slide?.text ?? DEFAULT_TEXT_SLIDE;
  const [heading, setHeading] = useState(initial.heading);
  const [body, setBody] = useState(initial.body);
  const [align, setAlign] = useState<TextAlign>(initial.align);
  const [textColor, setTextColor] = useState(initial.textColor);
  const [backgroundColor, setBackgroundColor] = useState(initial.backgroundColor);
  const [nhsLogo, setNhsLogo] = useState<LogoPosition>(initial.nhsLogo);
  const [practiceLogo, setPracticeLogo] = useState<LogoPosition>(initial.practiceLogo);
  const [customDuration, setCustomDuration] = useState(slide?.durationMs != null);
  const [durationMs, setDurationMs] = useState(slide?.durationMs ?? defaultDurationMs);
  const [startAt, setStartAt] = useState<string | null>(slide?.startAt ?? null);
  const [endAt, setEndAt] = useState<string | null>(slide?.endAt ?? null);
  const [repeat, setRepeat] = useState<ScheduleRepeat>(slide?.repeat ?? "none");
  const [saving, setSaving] = useState(false);

  const content: TextSlideContent = {
    heading,
    body,
    align,
    textColor,
    backgroundColor,
    nhsLogo,
    practiceLogo,
  };

  async function save() {
    if (!heading.trim() && !body.trim()) {
      toast.error("Add a heading or some body text.");
      return;
    }
    setSaving(true);
    const payload = {
      text: content,
      durationMs: customDuration ? durationMs : null,
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
          `/api/admin/practices/${slug}/slides/text`,
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
      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        {/* Live preview */}
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border shadow-sm" style={{ aspectRatio: "16 / 9" }}>
            <div className="relative h-full w-full">
              <TextSlideView content={content} practiceLogoUrl={practiceLogoUrl} />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">Live preview</p>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-heading">Heading</Label>
            <Input
              id="t-heading"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="e.g. Welcome to Example Surgery"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-body">Body</Label>
            <Textarea
              id="t-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Supporting text…"
              maxLength={1000}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Text alignment</Label>
            <Select value={align} onValueChange={(v) => setAlign(v as TextAlign)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Centre</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Background" value={backgroundColor} onChange={setBackgroundColor} />
            <ColorField label="Text colour" value={textColor} onChange={setTextColor} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PositionSelect label="NHS logo" value={nhsLogo} onChange={setNhsLogo} />
            <PositionSelect
              label="Practice logo"
              value={practiceLogo}
              onChange={setPracticeLogo}
              disabled={!practiceLogoUrl}
              hint={!practiceLogoUrl ? "Upload one in settings →" : undefined}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
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
          {slide ? "Save slide" : "Add slide"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function TextSlideDialog({
  open,
  onOpenChange,
  slug,
  slide,
  practiceLogoUrl,
  defaultDurationMs,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  slide: DraftSlide | null;
  practiceLogoUrl: string | null;
  defaultDurationMs: number;
  onSaved: (slide: DraftSlide, isNew: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{slide ? "Edit text slide" : "New text slide"}</DialogTitle>
          <DialogDescription>
            Compose a slide in-app — no image needed.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <TextForm
            key={slide?.id ?? "new"}
            slug={slug}
            slide={slide}
            practiceLogoUrl={practiceLogoUrl}
            defaultDurationMs={defaultDurationMs}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
