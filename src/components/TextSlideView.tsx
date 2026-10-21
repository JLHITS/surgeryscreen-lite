import type { CSSProperties } from "react";
import type { LogoPosition, TextSlideContent } from "@/lib/types";
import { NHS_LOGO_URL, NHS_LOGO_WHITE_URL } from "@/lib/nhs-logo";

/**
 * Is this background dark? Then the NHS logo is used reversed (a white box):
 * the blue one would disappear into NHS Blue.
 */
function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return luminance < 0.3;
}

function cornerStyle(pos: Exclude<LogoPosition, "none">, inset: string): CSSProperties {
  const v = pos.startsWith("top") ? { top: inset } : { bottom: inset };
  const h = pos.endsWith("left") ? { left: inset } : { right: inset };
  return { position: "absolute", ...v, ...h };
}

/**
 * Renders an in-app text slide. Sizes use container-query units (`cqmin`) so it
 * looks identical whether it fills a TV or a small preview tile — callers just
 * give it a sized, `container-type: size` parent (which this provides).
 */
export function TextSlideView({
  content,
  practiceLogoUrl,
  className,
}: {
  content: TextSlideContent;
  practiceLogoUrl?: string | null;
  className?: string;
}) {
  const items =
    content.align === "left"
      ? "flex-start"
      : content.align === "right"
        ? "flex-end"
        : "center";

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        containerType: "size",
        backgroundColor: content.backgroundColor,
        color: content.textColor,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: items,
          textAlign: content.align,
          padding: "9cqmin",
          gap: "3cqmin",
        }}
      >
        {content.heading && (
          <h1
            style={{
              fontSize: "8.5cqmin",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.01em",
              margin: 0,
              maxWidth: "100%",
            }}
          >
            {content.heading}
          </h1>
        )}
        {content.body && (
          <p
            style={{
              fontSize: "4.6cqmin",
              fontWeight: 500,
              lineHeight: 1.3,
              margin: 0,
              maxWidth: "100%",
              whiteSpace: "pre-wrap",
            }}
          >
            {content.body}
          </p>
        )}
      </div>

      {content.nhsLogo !== "none" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={isDark(content.backgroundColor) ? NHS_LOGO_WHITE_URL : NHS_LOGO_URL}
          alt="NHS"
          style={{ ...cornerStyle(content.nhsLogo, "5cqmin"), height: "11cqmin", width: "auto" }}
        />
      )}
      {content.practiceLogo !== "none" && practiceLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={practiceLogoUrl}
          alt=""
          style={{
            ...cornerStyle(content.practiceLogo, "5cqmin"),
            height: "12cqmin",
            maxWidth: "34cqmin",
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
}
