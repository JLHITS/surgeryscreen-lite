import type { CSSProperties } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Moon,
  Sun,
} from "lucide-react";
import { weatherKind } from "@/lib/weather";

/**
 * WMO weather code → icon. Inline SVG rather than emoji: kiosk devices such as
 * a Raspberry Pi ship without a colour-emoji font and draw emoji as empty boxes.
 */
export function WeatherIcon({
  code,
  isDay = true,
  style,
  className,
}: {
  code: number;
  isDay?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  const props = {
    "aria-hidden": true as const,
    className,
    style: { width: "1.15em", height: "1.15em", flexShrink: 0, ...style },
  };
  switch (weatherKind(code)) {
    case "clear":
      return isDay ? <Sun {...props} /> : <Moon {...props} />;
    case "partly":
      return isDay ? <CloudSun {...props} /> : <CloudMoon {...props} />;
    case "cloudy":
      return <Cloud {...props} />;
    case "fog":
      return <CloudFog {...props} />;
    case "drizzle":
      return <CloudDrizzle {...props} />;
    case "rain":
      return <CloudRain {...props} />;
    case "snow":
      return <CloudSnow {...props} />;
    case "showers":
      return <CloudSunRain {...props} />;
    default:
      return <CloudLightning {...props} />;
  }
}
