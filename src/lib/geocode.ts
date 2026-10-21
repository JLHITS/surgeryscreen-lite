/** A place found by name, via Open-Meteo's free geocoding service. */
export interface Place {
  latitude: number;
  longitude: number;
  /** e.g. "Nottingham, England, GB" */
  label: string;
}

/** Look up a town or city by name. Returns null when nothing matches. */
export async function findPlace(query: string): Promise<Place | null> {
  const q = query.trim();
  if (!q) return null;
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`,
  );
  if (!res.ok) throw new Error(`Geocoding ${res.status}`);
  const json = await res.json();
  const r = json?.results?.[0];
  if (!r) return null;
  return {
    latitude: r.latitude,
    longitude: r.longitude,
    label: [r.name, r.admin1, r.country_code].filter(Boolean).join(", "),
  };
}
