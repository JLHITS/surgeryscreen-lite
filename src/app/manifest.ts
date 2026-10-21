import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SurgeryScreen Lite",
    short_name: "SurgeryScreen",
    description: "Free, open-source waiting-room slideshow for GP practices.",
    start_url: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#000000",
    theme_color: "#005EB8",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
