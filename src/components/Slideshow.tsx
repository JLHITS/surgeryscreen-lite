"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/cn";
import { TextSlideView } from "@/components/TextSlideView";
import { Widgets } from "@/components/display/Widgets";
import {
  isSlideScheduledNow,
  type FitMode,
  type LogoCorner,
  type ProgressTimerSettings,
  type ScheduleRepeat,
  type SlideKind,
  type TextSlideContent,
  type TransitionType,
  type VideoSlideContent,
  type WidgetSettings,
} from "@/lib/types";

export interface ShowSlide {
  id: string;
  kind: SlideKind;
  url: string | null;
  text: TextSlideContent | null;
  video?: VideoSlideContent | null;
  /** Time on screen. For video slides, 0 = play once through, then advance. */
  durationMs: number;
  caption: string | null;
  fit: FitMode;
  startAt: string | null;
  endAt: string | null;
  repeat?: ScheduleRepeat;
}

/** Safety cap for "play to the end" videos whose ended event never fires. */
const MAX_NATURAL_VIDEO_MS = 20 * 60_000;
/** Retry a failed active video periodically while its poster remains visible. */
const VIDEO_RETRY_MS = 30_000;

interface SlideshowProps {
  slides: ShowSlide[];
  transition: TransitionType;
  transitionMs: number;
  backgroundColor: string;
  shuffle: boolean;
  loop: boolean;
  showClock: boolean;
  widgets?: WidgetSettings;
  progressTimer?: ProgressTimerSettings;
  practiceLogoUrl?: string | null;
  /** Show every slide regardless of its schedule (used by the editor preview). */
  ignoreSchedule?: boolean;
  className?: string;
}

function buildOrder(n: number, shuffle: boolean): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  if (!shuffle) return order;
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Pure visual slideshow: cycles through (schedule-eligible) slides with the
 * configured transition. It fills its positioned parent, so callers control the
 * frame (an aspect-ratio box for previews, or the full viewport for a display).
 */
export function Slideshow({
  slides,
  transition,
  transitionMs,
  backgroundColor,
  shuffle,
  loop,
  showClock,
  widgets,
  progressTimer,
  practiceLogoUrl,
  ignoreSchedule,
  className,
}: SlideshowProps) {
  const [pos, setPos] = useState(0);
  // Bumped each loop so the play order reshuffles when shuffle is on.
  const [loopSeed, setLoopSeed] = useState(0);
  // Re-evaluate schedule windows over time without needing a republish.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (ignoreSchedule) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [ignoreSchedule]);

  const scheduled = useMemo(
    () => (ignoreSchedule ? slides : slides.filter((s) => isSlideScheduledNow(s, now))),
    [slides, ignoreSchedule, now],
  );

  // The slides actually in rotation. Previews show everything.
  const visible = scheduled;

  const order = useMemo(() => {
    void loopSeed; // re-derive a fresh (re)shuffled order each loop
    return buildOrder(visible.length, shuffle);
  }, [visible.length, shuffle, loopSeed]);

  const safePos = Math.min(pos, Math.max(0, order.length - 1));
  const activeIndex = order[safePos] ?? 0;
  const activeId = visible[activeIndex]?.id;
  const current = visible[activeIndex];
  // The slide after the current one in play order (preloaded when it's video).
  const nextId = visible[order[(safePos + 1) % Math.max(1, order.length)] ?? -1]?.id;

  const atLast = safePos >= order.length - 1;
  const willAdvance = visible.length > 1 && !(atLast && !loop);

  // Nothing interrupts the slideshow in Lite (the full edition pauses it for
  // patient calls), so playback is never held.
  const held = false;

  const advance = useCallback(() => {
    setPos((p) => {
      const next = p + 1;
      if (next < order.length) return next;
      if (shuffle) setLoopSeed((s) => s + 1);
      return 0;
    });
  }, [order.length, shuffle]);

  // Time left on the current slide's clock, carried across holds/re-renders.
  const remainingRef = useRef<number | null>(null);
  useEffect(() => {
    remainingRef.current = null; // new slide → fresh clock
  }, [activeId]);

  useEffect(() => {
    if (visible.length <= 1 || !current || (atLast && !loop)) return;
    if (held) return;

    // "Play to the end" videos advance from the <video> ended event; the
    // timeout here is only a safety net.
    const isNaturalVideo = current.kind === "video" && current.durationMs === 0;
    const total = isNaturalVideo ? MAX_NATURAL_VIDEO_MS : Math.max(500, current.durationMs);
    const wait = remainingRef.current ?? total;
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      remainingRef.current = null;
      advance();
    }, wait);

    return () => {
      clearTimeout(timer);
      // Interrupted (hold / re-render): remember what was left on the clock.
      remainingRef.current = Math.max(250, wait - (Date.now() - startedAt));
    };
  }, [atLast, visible, current, loop, held, advance]);

  /** A "play once through" video finished — move on (or replay if looping alone). */
  const handleVideoEnded = useCallback(
    (el: HTMLVideoElement | null) => {
      if (visible.length > 1 && !(atLast && !loop)) {
        remainingRef.current = null;
        advance();
      } else if (visible.length <= 1 && loop && el) {
        el.currentTime = 0;
        el.play().catch(() => {});
      }
      // Last slide with loop off: freeze on the final frame, like images.
    },
    [visible.length, atLast, loop, advance],
  );

  const failedVideoIds = useRef(new Set<string>());
  const handleVideoPlaybackReady = useCallback((slideId: string) => {
    failedVideoIds.current.delete(slideId);
  }, []);
  const handleVideoPlaybackError = useCallback(
    (slideId: string) => {
      failedVideoIds.current.add(slideId);
      const allVisibleSlidesFailed =
        visible.length > 0 &&
        visible.every(
          (slide) => slide.kind === "video" && failedVideoIds.current.has(slide.id),
        );
      // Skip an isolated bad link. If every visible slide has failed, hold on
      // this poster and let its player retry instead of spinning continuously.
      if (!allVisibleSlidesFailed) handleVideoEnded(null);
    },
    [handleVideoEnded, visible],
  );

  const ms = transition === "none" ? 0 : transitionMs;

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ backgroundColor, containerType: "size" }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        {scheduled.map((slide) => {
          const active = slide.id === activeId;
          return (
            <div
              key={slide.id}
              className="absolute inset-0 flex items-center justify-center"
              style={{
                opacity: active ? 1 : 0,
                zIndex: active ? 2 : 1,
                transform:
                  !active && transition === "slide" ? "translateX(2%)" : "translateX(0)",
                transition: `opacity ${ms}ms ease, transform ${ms}ms ease`,
              }}
            >
              {slide.kind === "text" && slide.text ? (
                <TextSlideView content={slide.text} practiceLogoUrl={practiceLogoUrl} />
              ) : slide.kind === "video" && slide.video ? (
                <SlideVideo
                  slideId={slide.id}
                  video={slide.video}
                  fit={slide.fit}
                  active={active}
                  held={held}
                  // Mount only the active and next-up video so a playlist of
                  // videos never downloads all at once (kind to a Pi 4).
                  mounted={active || slide.id === nextId}
                  loopVideo={slide.durationMs > 0}
                  onEnded={slide.durationMs === 0 ? handleVideoEnded : undefined}
                  onPlaybackError={handleVideoPlaybackError}
                  onPlaybackReady={handleVideoPlaybackReady}
                />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.url ?? ""}
                    alt={slide.caption ?? ""}
                    draggable={false}
                    className="h-full w-full select-none"
                    style={{ objectFit: slide.fit }}
                  />
                  {slide.caption && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-[3%]">
                      <p
                        className="font-medium leading-tight text-white drop-shadow"
                        style={{ fontSize: "3cqw" }}
                      >
                        {slide.caption}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {widgets?.enabled ? (
        <Widgets settings={widgets} />
      ) : (
        showClock && <Clock />
      )}

      {progressTimer?.enabled && willAdvance && current && current.durationMs > 0 && (
        <SlideTimerRing
          durationMs={Math.max(500, current.durationMs)}
          settings={progressTimer}
          renderKey={`${safePos}-${loopSeed}`}
          paused={held}
        />
      )}
    </div>
  );
}

/**
 * Start (or resume) a video. Browsers refuse to start video *with sound* until
 * the page has had a user gesture — an unattended kiosk may never get one — so
 * fall back to playing muted rather than freezing on the poster. Other failures
 * (bad link, network) arrive through the element's error event instead.
 */
function playVideo(el: HTMLVideoElement, wantSound: boolean) {
  el.muted = !wantSound;
  el.play().catch((err: unknown) => {
    if (err instanceof DOMException && err.name === "NotAllowedError" && !el.muted) {
      el.muted = true;
      el.play().catch(() => {});
    }
  });
}

/**
 * A video slide. Streams straight from its URL; plays only while its slide is
 * active, and rewinds when it leaves the screen.
 */
function SlideVideo({
  slideId,
  video,
  fit,
  active,
  held,
  mounted,
  loopVideo,
  onEnded,
  onPlaybackError,
  onPlaybackReady,
}: {
  slideId: string;
  video: VideoSlideContent;
  fit: FitMode;
  active: boolean;
  held: boolean;
  mounted: boolean;
  loopVideo: boolean;
  onEnded?: (el: HTMLVideoElement | null) => void;
  onPlaybackError?: (slideId: string) => void;
  onPlaybackReady?: (slideId: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const failed = useRef(false);
  const failureReported = useRef(false);
  const retryTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active && !held) {
      if (failed.current) {
        // A next-up preload failed: make one fresh request now that it is active.
        failed.current = false;
        failureReported.current = false;
        el.load();
      }
      playVideo(el, video.sound);
    } else {
      if (retryTimer.current != null) {
        window.clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      el.pause();
      if (!active) {
        failureReported.current = false;
        el.currentTime = 0; // rewind for its next appearance
      }
    }
  }, [active, held, mounted, video.url, video.sound]);

  useEffect(
    () => () => {
      if (retryTimer.current != null) window.clearTimeout(retryTimer.current);
    },
    [],
  );

  // A <video> removed from the page keeps its decoder and buffered media until
  // garbage collection. Release them as soon as it unmounts, so a kiosk that
  // cycles videos all day never holds more than the current and next-up one.
  useEffect(() => {
    const el = ref.current;
    if (!mounted || !el) return;
    return () => {
      // Still in the page = a dev StrictMode re-run, not a real unmount.
      if (el.isConnected) return;
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <video
      ref={ref}
      src={video.url}
      poster={video.poster}
      muted={!video.sound}
      loop={loopVideo}
      playsInline
      // Only the on-screen video buffers fully; the next-up one fetches just
      // enough to start promptly, so two videos never stream and decode at once.
      preload={active ? "auto" : "metadata"}
      onEnded={() => onEnded?.(ref.current)}
      onLoadedData={() => {
        failed.current = false;
        failureReported.current = false;
        if (retryTimer.current != null) {
          window.clearTimeout(retryTimer.current);
          retryTimer.current = null;
        }
        onPlaybackReady?.(slideId);
      }}
      onError={() => {
        failed.current = true;
        if (active && !failureReported.current) {
          failureReported.current = true;
          onPlaybackError?.(slideId);
        }
        if (active) {
          if (retryTimer.current != null) window.clearTimeout(retryTimer.current);
          retryTimer.current = window.setTimeout(() => {
            retryTimer.current = null;
            const el = ref.current;
            if (!el) return;
            failed.current = false;
            failureReported.current = false;
            el.load();
            if (!held) playVideo(el, video.sound);
          }, VIDEO_RETRY_MS);
        }
      }}
      className="h-full w-full"
      style={{ objectFit: fit }}
    />
  );
}

const TIMER_CORNER: Record<LogoCorner, CSSProperties> = {
  "top-left": { top: "4cqmin", left: "4cqmin" },
  "top-right": { top: "4cqmin", right: "4cqmin" },
  "bottom-left": { bottom: "4cqmin", left: "4cqmin" },
  "bottom-right": { bottom: "4cqmin", right: "4cqmin" },
};

/** A circular countdown ring that sweeps away over the slide's duration. */
function SlideTimerRing({
  durationMs,
  settings,
  renderKey,
  paused,
}: {
  durationMs: number;
  settings: ProgressTimerSettings;
  renderKey: string;
  paused?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        ...TIMER_CORNER[settings.position],
        width: "7cqmin",
        height: "7cqmin",
        zIndex: 6,
        pointerEvents: "none",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
      }}
    >
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r="45" fill="none" stroke={settings.color} strokeOpacity={0.25} strokeWidth="9" />
        <circle
          key={renderKey}
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={settings.color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray="283"
          style={{
            animation: `ss-slide-timer ${durationMs}ms linear forwards`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      </svg>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      suppressHydrationWarning
      className="pointer-events-none absolute right-[2.5%] top-[2.5%] z-10 rounded-full bg-black/45 px-[1.6cqw] py-[0.6cqw] font-semibold tabular-nums text-white backdrop-blur-sm"
      style={{ fontSize: "2.2cqw" }}
    >
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </div>
  );
}
