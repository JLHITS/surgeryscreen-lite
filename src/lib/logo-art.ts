/**
 * SurgeryScreen logo artwork — a hand-built vector recreation of the original
 * raster logo (a medical cross on a desktop monitor). This is the single source
 * of truth: the in-app <Logo> component and the generated static assets
 * (favicon, app icons, social image) all derive from these constants.
 *
 * The mark is a single even-odd path so it renders as one shape in any colour:
 *   - outer + inner rounded rectangles form the hollow monitor frame
 *   - the plus sits inside the screen (odd winding => filled)
 *   - the trapezoid neck + rounded foot form the detached stand
 */

/** Tight viewBox around the mark, for inline use beside the wordmark. */
export const MARK_VIEWBOX = "0 0 465 377";

/** Square, padded viewBox for standalone icons (favicon / app icons). */
export const ICON_VIEWBOX = "-48 -92 560 560";

/** The mark as one fill-rule="evenodd" path. */
export const MARK_PATH = [
  // Monitor frame: outer rounded rectangle…
  "M45,0 H420 A45,45 0 0 1 465,45 V270 A45,45 0 0 1 420,315 H45 A45,45 0 0 1 0,270 V45 A45,45 0 0 1 45,0 Z",
  // …minus the inner rounded rectangle (the screen) — leaves a 24px frame.
  "M45,24 H420 A21,21 0 0 1 441,45 V270 A21,21 0 0 1 420,291 H45 A21,21 0 0 1 24,270 V45 A21,21 0 0 1 45,24 Z",
  // Medical cross, centred in the screen.
  "M208,80 H258 V133 H310 V183 H258 V236 H208 V183 H157 V133 H208 Z",
  // Stand: trapezoid neck…
  "M175,338 H292 L307,360 H160 Z",
  // …and rounded foot.
  "M97,360 H368 A8,8 0 0 1 376,368 V369 A8,8 0 0 1 368,377 H97 A8,8 0 0 1 89,369 V368 A8,8 0 0 1 97,360 Z",
].join(" ");

/** The wordmark text. */
export const WORDMARK = "SurgeryScreen";
