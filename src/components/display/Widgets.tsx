"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Flower2, Wind } from "lucide-react";
import { WeatherIcon } from "@/components/display/WeatherIcon";
import { LEVEL_LABEL, fetchAirAndPollen, type AirAndPollen } from "@/lib/weather";
import type { LogoCorner, WidgetSettings } from "@/lib/types";

/** Bar thickness (overlays the slide). */
export const WIDGET_BAR_SIZE = "6cqmin";

/** Convert a #rrggbb colour + alpha to an rgba() string. */
function hexToRgba(hex: string, alpha: number): string {
  const a = Number.isFinite(alpha) ? alpha : 1;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface Weather {
  temp: number;
  code: number;
}

function useWeather(
  lat: number | null,
  lon: number | null,
  enabled: boolean,
): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (!enabled || lat == null || lon == null) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
        );
        const json = await res.json();
        if (!cancelled && json?.current) {
          setWeather({
            temp: Math.round(json.current.temperature_2m),
            code: json.current.weather_code,
          });
        }
      } catch {
        /* offline — keep last value */
      }
    }
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lat, lon, enabled]);
  return enabled && lat != null && lon != null ? weather : null;
}

/** Pollen and air quality for the weather location, refreshed hourly. */
function useAirAndPollen(
  lat: number | null,
  lon: number | null,
  enabled: boolean,
): AirAndPollen | null {
  const [data, setData] = useState<AirAndPollen | null>(null);
  useEffect(() => {
    if (!enabled || lat == null || lon == null) return;
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchAirAndPollen(lat!, lon!);
        if (!cancelled) setData(next);
      } catch {
        /* offline — keep last value */
      }
    }
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lat, lon, enabled]);
  return enabled && lat != null && lon != null ? data : null;
}

const CORNER_INSET: Record<LogoCorner, CSSProperties> = {
  "top-left": { top: "4cqmin", left: "4cqmin" },
  "top-right": { top: "4cqmin", right: "4cqmin" },
  "bottom-left": { bottom: "4cqmin", left: "4cqmin" },
  "bottom-right": { bottom: "4cqmin", right: "4cqmin" },
};

function WidgetItems({ settings, big }: { settings: WidgetSettings; big: boolean }) {
  const now = useNow(5000);
  const weather = useWeather(
    settings.weatherLatitude,
    settings.weatherLongitude,
    settings.weather,
  );
  const extras = useAirAndPollen(
    settings.weatherLatitude,
    settings.weatherLongitude,
    !!(settings.pollen || settings.airQuality),
  );

  const parts: ReactNode[] = [];
  if (settings.clock) {
    parts.push(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }
  if (settings.date) {
    parts.push(
      now.toLocaleDateString([], {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    );
  }
  if (settings.weather && weather) {
    parts.push(
      <>
        <WeatherIcon code={weather.code} />
        {`${weather.temp}°C`}
      </>,
    );
  }
  const iconStyle = { width: "1.1em", height: "1.1em", flexShrink: 0 };
  if (settings.pollen && extras?.pollen) {
    parts.push(
      <>
        <Flower2 aria-hidden style={iconStyle} />
        {`Pollen ${LEVEL_LABEL[extras.pollen.level].toLowerCase()}`}
      </>,
    );
  }
  if (settings.airQuality && extras?.air) {
    parts.push(
      <>
        <Wind aria-hidden style={iconStyle} />
        {`Air ${extras.air.label.toLowerCase()}`}
      </>,
    );
  }

  if (parts.length === 0) return null;

  return (
    <div
      suppressHydrationWarning
      style={{
        display: "flex",
        alignItems: "center",
        gap: big ? "2.4cqmin" : "2cqmin",
        fontSize: big ? "3.3cqmin" : "3cqmin",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {parts.map((p, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "1cqmin" }}>
          {i > 0 && <span style={{ opacity: 0.45 }}>•</span>}
          {p}
        </span>
      ))}
    </div>
  );
}

/** Live clock / date / weather overlay — a full-width bar or a floating chip. */
export function Widgets({ settings }: { settings: WidgetSettings }) {
  if (!settings.enabled) return null;
  if (
    !settings.clock &&
    !settings.date &&
    !settings.weather &&
    !settings.pollen &&
    !settings.airQuality
  ) {
    return null;
  }

  if (settings.layout === "bar") {
    const side: CSSProperties =
      settings.barPosition === "top" ? { top: 0 } : { bottom: 0 };
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          ...side,
          height: WIDGET_BAR_SIZE,
          background: hexToRgba(settings.backgroundColor, settings.opacity),
          color: settings.textColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 5cqmin",
          zIndex: 5,
        }}
      >
        <WidgetItems settings={settings} big />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        ...CORNER_INSET[settings.floatingCorner],
        background: hexToRgba(settings.backgroundColor, settings.opacity),
        color: settings.textColor,
        borderRadius: "3cqmin",
        padding: "2cqmin 3cqmin",
        zIndex: 5,
      }}
    >
      <WidgetItems settings={settings} big={false} />
    </div>
  );
}
