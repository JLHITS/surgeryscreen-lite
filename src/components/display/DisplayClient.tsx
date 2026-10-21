"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, MonitorPlay } from "lucide-react";
import { Slideshow, type ShowSlide } from "@/components/Slideshow";
import { ErrorBoundary } from "@/components/display/ErrorBoundary";
import { QUIET_POLL_MS, isQuietHours } from "@/lib/quiet";
import type { PublishedSnapshot } from "@/lib/types";

const POLL_MS = 20000;
const IDLE_MS = 3500;

function preloadImages(urls: string[]): Promise<void> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  ).then(() => undefined);
}

export function DisplayClient({
  slug,
  name,
  initialSnapshot,
}: {
  slug: string;
  name: string;
  initialSnapshot: PublishedSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState<PublishedSnapshot | null>(initialSnapshot);
  const versionRef = useRef(initialSnapshot?.version ?? -1);
  const snapshotFingerprintRef = useRef(
    initialSnapshot ? JSON.stringify(initialSnapshot) : "",
  );
  /** ETag of the snapshot on screen: unchanged polls come back as an empty 304. */
  const etagRef = useRef<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  // No pointer until a real mouse moves: kiosk screens have no mouse, and a
  // browser only re-checks the pointer when it moves.
  const [pointerUsed, setPointerUsed] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Offline resilience: cache the display so it survives wifi drops -------
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // --- Keep the screen awake -------------------------------------------------
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sentinel: any = null;
    let released = false;

    async function acquire() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wl = (navigator as any).wakeLock;
        if (wl) sentinel = await wl.request("screen");
      } catch {
        /* not supported / blocked — display still works */
      }
    }

    acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release?.().catch(() => {});
    };
  }, []);

  // --- Poll for newly published versions ------------------------------------
  // Slow to one tick every few minutes overnight (see lib/quiet.ts).
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/display/${slug}`, {
          cache: "no-store",
          headers: etagRef.current ? { "If-None-Match": etagRef.current } : undefined,
        });
        if (res.status === 304) return; // nothing new since the last poll
        if (res.status === 404) {
          versionRef.current = -1;
          snapshotFingerprintRef.current = "";
          etagRef.current = null;
          if (!cancelled) setSnapshot((cur) => (cur ? null : cur));
          return;
        }
        if (!res.ok) return;
        const next = (await res.json()) as PublishedSnapshot;
        const etag = res.headers.get("etag");
        const nextFingerprint = JSON.stringify(next);
        if (cancelled) return;
        if (
          next.version === versionRef.current &&
          nextFingerprint === snapshotFingerprintRef.current
        ) {
          etagRef.current = etag;
          return;
        }
        await preloadImages(
          next.slides.map((s) => s.url).filter((u): u is string => !!u),
        );
        if (cancelled) return;
        versionRef.current = next.version;
        snapshotFingerprintRef.current = nextFingerprint;
        etagRef.current = etag;
        setSnapshot(next);
      } catch {
        /* offline / transient — try again next tick */
      }
    }

    function schedule() {
      if (cancelled) return;
      timer = setTimeout(async () => {
        await poll();
        schedule();
      }, isQuietHours() ? QUIET_POLL_MS : POLL_MS);
    }

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [slug]);

  // --- Auto-hide cursor & controls when idle --------------------------------
  const wake = useCallback(() => {
    setControlsVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setControlsVisible(false), IDLE_MS);
  }, []);

  useEffect(() => {
    // Start the initial idle countdown; controls already render visible.
    idleTimer.current = setTimeout(() => setControlsVisible(false), IDLE_MS);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
    wake();
  }

  const showSlides: ShowSlide[] =
    snapshot?.slides.map((s) => ({
      id: s.id,
      kind: s.kind ?? "image",
      url: s.url,
      text: s.text ?? null,
      video: s.video ?? null,
      durationMs: s.durationMs,
      caption: s.caption,
      fit: "contain",
      startAt: s.startAt ?? null,
      endAt: s.endAt ?? null,
      repeat: s.repeat ?? "none",
    })) ?? [];

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black"
      style={{ cursor: controlsVisible && pointerUsed ? "default" : "none" }}
      onMouseMove={(e) => {
        if (e.movementX || e.movementY) setPointerUsed(true);
        wake();
      }}
      onPointerDown={wake}
    >
      {snapshot && showSlides.length > 0 ? (
        <ErrorBoundary>
          <Slideshow
            slides={showSlides}
            transition={snapshot.transition}
            transitionMs={snapshot.transitionMs}
            backgroundColor={snapshot.backgroundColor}
            shuffle={snapshot.shuffle}
            loop={snapshot.loop}
            showClock={snapshot.showClock}
            widgets={snapshot.widgets}
            progressTimer={snapshot.progressTimer}
            practiceLogoUrl={snapshot.practiceLogoUrl}
          />
        </ErrorBoundary>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white/90">
          <span className="grid size-16 place-items-center rounded-2xl bg-white/10">
            <MonitorPlay className="size-8" />
          </span>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="max-w-md text-white/60">
            This display will start automatically as soon as a slideshow is published.
          </p>
          <span className="mt-2 inline-flex items-center gap-2 text-sm text-white/40">
            <span className="size-2 animate-pulse rounded-full bg-white/50" />
            Waiting for content…
          </span>
        </div>
      )}

      {/* Fullscreen control (auto-hides) */}
      <button
        onClick={goFullscreen}
        className="absolute bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-opacity hover:bg-white/20"
        style={{ opacity: controlsVisible ? 1 : 0 }}
        aria-label="Enter fullscreen"
      >
        <Maximize className="size-4" />
        Fullscreen
      </button>
    </div>
  );
}
