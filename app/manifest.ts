import type { MetadataRoute } from "next";
import { THEME } from "@/lib/theme";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return {
    name: "Aditya Kumar Upadhyay — Complete Transformation Coach for Men",
    short_name: "Aditya Coach",
    description:
      "Men's lifestyle and transformation coaching in Kolkata and worldwide online.",
    start_url: `${base}/`,
    display: "standalone",
    background_color: THEME.splash,
    theme_color: THEME.dark,
    icons: [
      {
        src: `${base}/favicon.svg`,
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: `${base}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
