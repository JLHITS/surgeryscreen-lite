/**
 * Weather, pollen and air quality for the display (all from Open-Meteo: free,
 * no key, CORS-enabled, so screens fetch it directly). Shared by the widget
 * bar.
 */

// ── Conditions ───────────────────────────────────────────────────────────────

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "showers" | "storm";

/** WMO weather code → broad kind (drives the icon and the slide's colours). */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "showers";
  if (code <= 86) return "snow";
  return "storm";
}

const DESCRIPTIONS: Record<WeatherKind, string> = {
  clear: "Clear skies",
  partly: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Foggy",
  drizzle: "Drizzle",
  rain: "Rain",
  snow: "Snow",
  showers: "Showers",
  storm: "Thunderstorms",
};

export function weatherDescription(code: number, isDay = true): string {
  const kind = weatherKind(code);
  if (kind === "clear") return isDay ? "Sunny" : "Clear night";
  return DESCRIPTIONS[kind];
}

// ── Pollen ───────────────────────────────────────────────────────────────────

export type Level = "low" | "moderate" | "high" | "very-high";

export const LEVEL_LABEL: Record<Level, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very-high": "Very high",
};

type PollenType = "tree" | "grass" | "weed";

/**
 * Pollen count thresholds (grains/m³) on the US National Allergy Bureau
 * scale: [moderate from, high from, very high from].
 */
const POLLEN_THRESHOLDS: Record<PollenType, [number, number, number]> = {
  tree: [15, 90, 1500],
  grass: [5, 20, 200],
  weed: [10, 50, 500],
};

const POLLEN_SOURCES: Record<string, PollenType> = {
  alder_pollen: "tree",
  birch_pollen: "tree",
  olive_pollen: "tree",
  grass_pollen: "grass",
  mugwort_pollen: "weed",
  ragweed_pollen: "weed",
};

const POLLEN_TYPE_LABEL: Record<PollenType, string> = { tree: "tree", grass: "grass", weed: "weed" };

const LEVEL_ORDER: Level[] = ["low", "moderate", "high", "very-high"];

function pollenLevel(type: PollenType, count: number): Level {
  const [moderate, high, veryHigh] = POLLEN_THRESHOLDS[type];
  if (count >= veryHigh) return "very-high";
  if (count >= high) return "high";
  if (count >= moderate) return "moderate";
  return "low";
}

export interface PollenSummary {
  level: Level;
  /** The pollen type driving the level, e.g. "grass" (null when low). */
  main: string | null;
}

/** Today's overall pollen level from Open-Meteo hourly counts (worst type wins). */
export function summarisePollen(hourly: Record<string, (number | null)[] | undefined>): PollenSummary | null {
  let best: { level: Level; type: PollenType } | null = null;
  let any = false;
  for (const [key, type] of Object.entries(POLLEN_SOURCES)) {
    const values = (hourly[key] ?? []).filter((v): v is number => typeof v === "number");
    if (values.length === 0) continue;
    any = true;
    const level = pollenLevel(type, Math.max(...values));
    if (!best || LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(best.level)) best = { level, type };
  }
  if (!any || !best) return null; // outside Europe / no data
  return { level: best.level, main: best.level === "low" ? null : POLLEN_TYPE_LABEL[best.type] };
}

// ── Air quality ──────────────────────────────────────────────────────────────

export interface AirQualitySummary {
  label: string;
  /** Traffic-light band: good → bad. */
  band: "good" | "fair" | "moderate" | "poor" | "very-poor";
  index: number;
}

/** European Air Quality Index (0–100+) → plain-English band. */
export function summariseAirQuality(index: number | null | undefined): AirQualitySummary | null {
  if (typeof index !== "number" || !Number.isFinite(index)) return null;
  if (index < 20) return { label: "Good", band: "good", index };
  if (index < 40) return { label: "Fair", band: "fair", index };
  if (index < 60) return { label: "Moderate", band: "moderate", index };
  if (index < 80) return { label: "Poor", band: "poor", index };
  return { label: index < 100 ? "Very poor" : "Extremely poor", band: "very-poor", index };
}

// ── Fetching ─────────────────────────────────────────────────────────────────

export interface CurrentWeather {
  temp: number;
  feelsLike: number;
  code: number;
  isDay: boolean;
  windMph: number;
  humidity: number;
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  code: number;
  max: number;
  min: number;
  rainChance: number | null;
  uvMax: number | null;
}

export interface Forecast {
  current: CurrentWeather;
  days: DailyForecast[];
  sunrise: string | null;
  sunset: string | null;
}

export async function fetchForecast(lat: number, lon: number, signal?: AbortSignal): Promise<Forecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset" +
    "&timezone=auto&forecast_days=5&wind_speed_unit=mph";
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Forecast ${res.status}`);
  const json = await res.json();
  const c = json.current;
  const d = json.daily;
  return {
    current: {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      code: c.weather_code,
      isDay: c.is_day === 1,
      windMph: Math.round(c.wind_speed_10m),
      humidity: Math.round(c.relative_humidity_2m),
    },
    days: (d.time as string[]).map((date, i) => ({
      date,
      code: d.weather_code[i],
      max: Math.round(d.temperature_2m_max[i]),
      min: Math.round(d.temperature_2m_min[i]),
      rainChance: d.precipitation_probability_max?.[i] ?? null,
      uvMax: d.uv_index_max?.[i] ?? null,
    })),
    sunrise: d.sunrise?.[0] ?? null,
    sunset: d.sunset?.[0] ?? null,
  };
}

export interface AirAndPollen {
  air: AirQualitySummary | null;
  pollen: PollenSummary | null;
}

export async function fetchAirAndPollen(lat: number, lon: number, signal?: AbortSignal): Promise<AirAndPollen> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    "&current=european_aqi" +
    `&hourly=${Object.keys(POLLEN_SOURCES).join(",")}` +
    "&forecast_days=1&timezone=auto";
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Air quality ${res.status}`);
  const json = await res.json();
  return {
    air: summariseAirQuality(json.current?.european_aqi),
    pollen: summarisePollen(json.hourly ?? {}),
  };
}

// ── Health tip ───────────────────────────────────────────────────────────────

/** One short, relevant piece of advice for the waiting room. */
export function healthTip(
  forecast: Forecast | null,
  extras: AirAndPollen | null,
): string | null {
  const today = forecast?.days[0];
  if (extras?.air && (extras.air.band === "poor" || extras.air.band === "very-poor")) {
    return "Air quality is poor today. If you have a heart or lung condition, keep your reliever inhaler with you and take it easy outdoors.";
  }
  if (today && today.max >= 27) {
    return "It's hot today: drink plenty of water, stay out of the sun at midday and check on older neighbours.";
  }
  if (extras?.pollen && LEVEL_ORDER.indexOf(extras.pollen.level) >= 2) {
    return "Pollen is high today. Hay fever? Your pharmacist can help — antihistamines and nasal sprays are available without a prescription.";
  }
  if (today?.uvMax != null && today.uvMax >= 6) {
    return "The UV index is high today. Use sun cream of SPF 30 or more, and cover up between 11am and 3pm.";
  }
  if (today && today.min <= 2) {
    return "It's cold out. Keep warm, keep active and make sure you have enough of your regular medicines.";
  }
  return null;
}
