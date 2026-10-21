/**
 * Server-corrected time for display devices.
 *
 * A kiosk's own clock can't be trusted: a Raspberry Pi has no battery-backed
 * clock and, on networks that block internet time (common on NHS networks),
 * can come back from a reboot minutes, hours or months out. Timing decisions
 * (is a call too old to show? is it quiet hours?) use the server's clock
 * instead, learned from the time stamped on each poll response.
 */

let offsetMs = 0;

/**
 * Record the server's time from a poll response. `sentAt`/`receivedAt` are the
 * device times either side of the request; the midpoint allows for latency.
 */
export function syncServerClock(serverIso: string | undefined, sentAt: number, receivedAt: number) {
  const server = serverIso ? Date.parse(serverIso) : NaN;
  if (Number.isFinite(server)) offsetMs = server - (sentAt + receivedAt) / 2;
}

/** Milliseconds since the epoch by the server's clock (device clock until synced). */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** How far the device clock is from the server's (ms; positive = device is slow). */
export function serverClockOffsetMs(): number {
  return offsetMs;
}
