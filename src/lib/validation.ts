import { z } from "zod";

export const aspectRatioSchema = z.enum(["16:9", "4:3", "9:16"]);
export const fitSchema = z.enum(["contain", "cover"]);
export const transitionSchema = z.enum(["fade", "slide", "none"]);
export const logoCornerSchema = z.enum([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);
export const logoPositionSchema = z.enum([
  "none",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);
export const textAlignSchema = z.enum(["left", "center", "right"]);

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #000000");
/** datetime-local value (e.g. 2026-06-18T09:00), stored verbatim. */
const scheduleAt = z.string().max(40).nullable().optional();
/** Optional so editors opened before repeating schedules shipped can still save. */
const scheduleRepeat = z.enum(["none", "weekly", "monthly", "yearly"]).optional();

export const widgetSettingsSchema = z.object({
  enabled: z.boolean(),
  clock: z.boolean(),
  date: z.boolean(),
  weather: z.boolean(),
  weatherLatitude: z.number().min(-90).max(90).nullable(),
  weatherLongitude: z.number().min(-180).max(180).nullable(),
  weatherLabel: z.string().max(80),
  // Optional so editors opened before these shipped can still save.
  pollen: z.boolean().optional(),
  airQuality: z.boolean().optional(),
  layout: z.enum(["floating", "bar"]),
  barPosition: z.enum(["top", "bottom"]),
  floatingCorner: logoCornerSchema,
  backgroundColor: hexColor,
  textColor: hexColor,
  opacity: z.number().min(0).max(1),
});

export const progressTimerSchema = z.object({
  enabled: z.boolean(),
  position: logoCornerSchema,
  color: hexColor,
});

export const settingsSchema = z.object({
  aspectRatio: aspectRatioSchema,
  defaultDurationMs: z.number().int().min(1000).max(600000),
  transition: transitionSchema,
  transitionMs: z.number().int().min(0).max(5000),
  fit: fitSchema,
  backgroundColor: hexColor,
  shuffle: z.boolean(),
  loop: z.boolean(),
  showClock: z.boolean(),
  widgets: widgetSettingsSchema,
  progressTimer: progressTimerSchema,
  logoKey: z.string().max(300).nullable(),
});

export const textSlideContentSchema = z.object({
  heading: z.string().max(200),
  body: z.string().max(1000),
  align: textAlignSchema,
  textColor: hexColor,
  backgroundColor: hexColor,
  nhsLogo: logoPositionSchema,
  practiceLogo: logoPositionSchema,
});

export const loginSchema = z.object({ password: z.string().min(1).max(200) });

export const createPracticeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(64).optional(),
});

export const updatePracticeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  settings: settingsSchema.optional(),
});

export const createTextSlideSchema = z.object({
  text: textSlideContentSchema,
  durationMs: z.number().int().min(1000).max(600000).nullable().optional(),
  startAt: scheduleAt,
  endAt: scheduleAt,
  repeat: scheduleRepeat,
});

export const videoSlideContentSchema = z.object({
  // https only: the display itself is served over https, so http video would
  // be blocked as mixed content.
  url: z
    .string()
    .trim()
    .url()
    .max(600)
    .refine((u) => u.startsWith("https://"), "Video links must start with https://"),
  poster: z
    .string()
    .trim()
    .url()
    .max(600)
    .refine((u) => u.startsWith("https://"), "Video posters must start with https://")
    .optional(),
  title: z.string().trim().max(120),
  sound: z.boolean(),
});

export const createVideoSlideSchema = z.object({
  video: videoSlideContentSchema,
  /** Null/absent = play the video once through, then advance. */
  durationMs: z.number().int().min(1000).max(600000).nullable().optional(),
  startAt: scheduleAt,
  endAt: scheduleAt,
  repeat: scheduleRepeat,
});

export const slideUpdateSchema = z.object({
  caption: z.string().max(280).nullable().optional(),
  durationMs: z.number().int().min(1000).max(600000).nullable().optional(),
  fit: fitSchema.nullable().optional(),
  text: textSlideContentSchema.nullable().optional(),
  video: videoSlideContentSchema.nullable().optional(),
  startAt: scheduleAt,
  endAt: scheduleAt,
  repeat: scheduleRepeat,
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** Image MIME types we accept for upload (all rasterisable by sharp). */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
