import type { MetadataRoute } from "next";

/**
 * Web app manifest (Module 10.1). Makes the app installable to a home screen.
 * Served at `/manifest.webmanifest`; linked automatically via the layout's
 * `metadata` (Next injects the <link rel="manifest"> tag).
 *
 * Icons live in `public/` and are generated from the lucide GraduationCap mark
 * (see scripts/gen-icons.mjs). The push service worker is separate
 * (`/firebase-messaging-sw.js`, Module 4.4) and is not referenced here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "School Management",
    short_name: "School",
    description: "Multi-tenant school management platform",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a1a",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
