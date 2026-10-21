/**
 * Overnight quiet hours for display devices.
 *
 * Waiting rooms are empty overnight, but TVs keep running — and their 3s/20s
 * polling kept the database awake 24/7 (free-tier Postgres meters compute by
 * the hour awake). Between 21:30 and 06:30, displays relax every poll to one
 * slow tick so the database can autosuspend, and snap back at breakfast. The
 * window uses the display's time zone but the server's clock, so a device
 * whose clock is wrong can't slow itself down in the middle of the day.
 */
import { serverNow } from "@/lib/server-clock";

const QUIET_START_MINUTES = 21 * 60 + 30; // 21:30
const QUIET_END_MINUTES = 6 * 60 + 30; // 06:30

/** Slow poll interval used for everything during quiet hours. */
export const QUIET_POLL_MS = 10 * 60_000;

export function isQuietHours(now: Date = new Date(serverNow())): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= QUIET_START_MINUTES || minutes < QUIET_END_MINUTES;
}
