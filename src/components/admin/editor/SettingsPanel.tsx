"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ChevronDown,
  CircleDashed,
  CloudSun,
  Copy,
  Image as ImageIcon,
  ImageOff,
  Link2,
  Loader2,
  MapPin,
  Play,
  Timer,
  Tv,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { formatDuration } from "@/lib/format";
import { findPlace } from "@/lib/geocode";
import type {
  ProgressTimerSettings,
  SlideshowSettings,
  WidgetSettings,
} from "@/lib/types";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/**
 * Collapsible settings group. The panel is a narrow sidebar, so an accordion
 * (compact rows, one group open at a time) beats a wall of controls or tabs
 * that would wrap at this width.
 */
function Section({
  title,
  icon,
  status,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  /** At-a-glance summary shown while collapsed (e.g. "16:9", On/Off). */
  status?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent/50"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {status}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-5 pt-1 duration-200 animate-in fade-in slide-in-from-top-1">
          {children}
        </div>
      )}
    </div>
  );
}

/** Green "On" chip for feature groups that are switched on. */
function OnBadge() {
  return (
    <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
      On
    </span>
  );
}

function ValueHint({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-xs font-normal text-muted-foreground">{children}</span>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border bg-card p-1"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono uppercase"
          spellCheck={false}
        />
      </div>
    </Field>
  );
}

function WeatherLocation({
  widgets,
  patch,
}: {
  widgets: WidgetSettings;
  patch: (p: Partial<WidgetSettings>) => void;
}) {
  const [query, setQuery] = useState(widgets.weatherLabel);
  const [loading, setLoading] = useState(false);

  async function find() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const place = await findPlace(query);
      if (!place) {
        toast.error("Place not found — try a town or postcode.");
        return;
      }
      // Set all three in one update — separate calls would clobber each other.
      patch({
        weatherLatitude: place.latitude,
        weatherLongitude: place.longitude,
        weatherLabel: place.label,
      });
      setQuery(place.label);
      toast.success(`Weather set to ${place.label}`);
    } catch {
      toast.error("Couldn't look up that location.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Field label="Weather location">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              find();
            }
          }}
          placeholder="Town or city"
        />
        <Button type="button" variant="outline" size="icon" onClick={find} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
        </Button>
      </div>
      {widgets.weatherLatitude == null && (
        <p className="text-xs text-muted-foreground">Set a location to show the weather.</p>
      )}
    </Field>
  );
}

function LogoUpload({
  slug,
  logoKey,
  onChange,
}: {
  slug: string;
  logoKey: string | null;
  onChange: (key: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = logoKey ? `/api/media/${logoKey}` : null;

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { key } = await api<{ key: string }>(
        `/api/admin/practices/${slug}/logo`,
        { method: "POST", body: fd },
      );
      onChange(key);
      toast.success("Practice logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload logo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label="Practice logo" hint="Used on text slides">
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Practice logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageOff className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {url ? "Replace" : "Upload"}
          </Button>
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </Field>
  );
}

function useOrigin(): string {
  // window isn't available during SSR, so read the origin hydration-safely.
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

function copyText(text: string, done: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(done),
    () => toast.error("Couldn't copy"),
  );
}

/** The address to open on the TV. */
function ScreenAddressOptions({ slug, siteUrl }: { slug: string; siteUrl?: string }) {
  const origin = useOrigin();
  const address = `${siteUrl || origin}/${slug}`;
  const piCommand = `curl -fsSL ${siteUrl || origin}/pi-setup.sh | sudo bash -s -- '${address}'`;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          readOnly
          value={address}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Screen address"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => copyText(address, "Screen address copied")}
          aria-label="Copy screen address"
        >
          <Copy className="size-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Open this on the waiting-room TV. To set up a Raspberry Pi to show it full screen from
        start-up, run this once in the Pi&apos;s Terminal:
      </p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={piCommand}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Raspberry Pi setup command"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => copyText(piCommand, "Setup command copied")}
          aria-label="Copy Raspberry Pi setup command"
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function SettingsPanel({
  slug,
  siteUrl,
  settings,
  onChange,
}: {
  slug: string;
  /** Canonical base URL (SITE_URL env); "" → use the browser's origin. */
  siteUrl?: string;
  settings: SlideshowSettings;
  onChange: (next: SlideshowSettings) => void;
}) {
  const set = <K extends keyof SlideshowSettings>(key: K, value: SlideshowSettings[K]) =>
    onChange({ ...settings, [key]: value });
  const setWidget = <K extends keyof WidgetSettings>(key: K, value: WidgetSettings[K]) =>
    onChange({ ...settings, widgets: { ...settings.widgets, [key]: value } });
  const patchWidgets = (patch: Partial<WidgetSettings>) =>
    onChange({ ...settings, widgets: { ...settings.widgets, ...patch } });
  const setTimer = <K extends keyof ProgressTimerSettings>(
    key: K,
    value: ProgressTimerSettings[K],
  ) => onChange({ ...settings, progressTimer: { ...settings.progressTimer, [key]: value } });

  const w = settings.widgets;
  const t = settings.progressTimer;

  // Accordion: one group open at a time keeps the sidebar scannable.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const section = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((cur) => (cur === id ? null : id)),
  });

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Section
        title="Screen address"
        icon={<Link2 className="size-4" />}
        status={<ValueHint>For the TV</ValueHint>}
        {...section("address")}
      >
        <ScreenAddressOptions slug={slug} siteUrl={siteUrl} />
      </Section>

      <Section
        title="Television format"
        icon={<Tv className="size-4" />}
        status={<ValueHint>{settings.aspectRatio}</ValueHint>}
        {...section("format")}
      >
        <Field label="Aspect ratio">
          <Select
            value={settings.aspectRatio}
            onValueChange={(v) => set("aspectRatio", v as SlideshowSettings["aspectRatio"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">16:9 — Landscape TV</SelectItem>
              <SelectItem value="4:3">4:3 — Classic</SelectItem>
              <SelectItem value="9:16">9:16 — Portrait</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Image fit" hint="Default for all slides">
          <Select value={settings.fit} onValueChange={(v) => set("fit", v as SlideshowSettings["fit"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contain">Fit (show whole image)</SelectItem>
              <SelectItem value="cover">Fill (crop to edges)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <ColorRow
          label="Background"
          value={settings.backgroundColor}
          onChange={(v) => set("backgroundColor", v)}
        />
      </Section>

      <Section
        title="Timing"
        icon={<Timer className="size-4" />}
        status={<ValueHint>{formatDuration(settings.defaultDurationMs)}</ValueHint>}
        {...section("timing")}
      >
        <Field label="Time per slide" hint={formatDuration(settings.defaultDurationMs)}>
          <Slider
            min={2000}
            max={60000}
            step={500}
            value={[settings.defaultDurationMs]}
            onValueChange={([v]) => set("defaultDurationMs", v)}
          />
        </Field>

        <Field label="Transition">
          <Select
            value={settings.transition}
            onValueChange={(v) => set("transition", v as SlideshowSettings["transition"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fade">Crossfade</SelectItem>
              <SelectItem value="slide">Slide</SelectItem>
              <SelectItem value="none">None (cut)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {settings.transition !== "none" && (
          <Field label="Transition speed" hint={`${settings.transitionMs} ms`}>
            <Slider
              min={200}
              max={3000}
              step={100}
              value={[settings.transitionMs]}
              onValueChange={([v]) => set("transitionMs", v)}
            />
          </Field>
        )}
      </Section>

      <Section
        title="Playback"
        icon={<Play className="size-4" />}
        status={<ValueHint>{settings.shuffle ? "Shuffle" : "In order"}</ValueHint>}
        {...section("playback")}
      >
        <ToggleRow
          label="Shuffle slides"
          hint="Randomise order each loop"
          checked={settings.shuffle}
          onChange={(v) => set("shuffle", v)}
        />
        <ToggleRow
          label="Loop"
          hint="Restart after the last slide"
          checked={settings.loop}
          onChange={(v) => set("loop", v)}
        />
      </Section>

      <Section
        title="Live widgets"
        icon={<CloudSun className="size-4" />}
        status={w.enabled ? <OnBadge /> : <ValueHint>Off</ValueHint>}
        {...section("widgets")}
      >
        <ToggleRow
          label="Show widgets"
          hint="Clock, date & weather overlay"
          checked={w.enabled}
          onChange={(v) => setWidget("enabled", v)}
        />
        {w.enabled && (
          <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
            <div className="space-y-3">
              <ToggleRow label="Clock" checked={w.clock} onChange={(v) => setWidget("clock", v)} />
              <ToggleRow label="Date" checked={w.date} onChange={(v) => setWidget("date", v)} />
              <ToggleRow
                label="Weather"
                checked={w.weather}
                onChange={(v) => setWidget("weather", v)}
              />
              <ToggleRow
                label="Pollen"
                hint="Today's pollen level"
                checked={w.pollen}
                onChange={(v) => setWidget("pollen", v)}
              />
              <ToggleRow
                label="Air quality"
                hint="Current air quality"
                checked={w.airQuality}
                onChange={(v) => setWidget("airQuality", v)}
              />
            </div>

            {(w.weather || w.pollen || w.airQuality) && (
              <WeatherLocation widgets={w} patch={patchWidgets} />
            )}

            <Field label="Layout">
              <Select value={w.layout} onValueChange={(v) => setWidget("layout", v as WidgetSettings["layout"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar (thin strip across the slide)</SelectItem>
                  <SelectItem value="floating">Floating (corner chip)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {w.layout === "bar" ? (
              <Field label="Bar position">
                <Select
                  value={w.barPosition}
                  onValueChange={(v) => setWidget("barPosition", v as WidgetSettings["barPosition"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="top">Top</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field label="Corner">
                <Select
                  value={w.floatingCorner}
                  onValueChange={(v) =>
                    setWidget("floatingCorner", v as WidgetSettings["floatingCorner"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Top left</SelectItem>
                    <SelectItem value="top-right">Top right</SelectItem>
                    <SelectItem value="bottom-left">Bottom left</SelectItem>
                    <SelectItem value="bottom-right">Bottom right</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <ColorRow
                label="Background"
                value={w.backgroundColor}
                onChange={(v) => setWidget("backgroundColor", v)}
              />
              <ColorRow label="Text" value={w.textColor} onChange={(v) => setWidget("textColor", v)} />
            </div>

            <Field label="Background opacity" hint={`${Math.round(w.opacity * 100)}%`}>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[w.opacity]}
                onValueChange={([v]) => setWidget("opacity", v)}
              />
            </Field>
          </div>
        )}
      </Section>

      <Section
        title="Slide timer"
        icon={<CircleDashed className="size-4" />}
        status={t.enabled ? <OnBadge /> : <ValueHint>Off</ValueHint>}
        {...section("timer")}
      >
        <ToggleRow
          label="Countdown ring"
          hint="Circle showing time left on each slide"
          checked={t.enabled}
          onChange={(v) => setTimer("enabled", v)}
        />
        {t.enabled && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-4">
            <Field label="Corner">
              <Select
                value={t.position}
                onValueChange={(v) => setTimer("position", v as ProgressTimerSettings["position"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top-left">Top left</SelectItem>
                  <SelectItem value="top-right">Top right</SelectItem>
                  <SelectItem value="bottom-left">Bottom left</SelectItem>
                  <SelectItem value="bottom-right">Bottom right</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <ColorRow label="Colour" value={t.color} onChange={(v) => setTimer("color", v)} />
          </div>
        )}
      </Section>

      <Section
        title="Branding"
        icon={<ImageIcon className="size-4" />}
        status={<ValueHint>{settings.logoKey ? "Logo set" : "No logo"}</ValueHint>}
        {...section("branding")}
      >
        <LogoUpload slug={slug} logoKey={settings.logoKey} onChange={(key) => set("logoKey", key)} />
      </Section>
    </div>
  );
}
