import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/** Index public tool pages and exclude private operational routes. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/job/", "/jobs/", "/result/", "/results/", "/download/", "/downloads/", "/admin/", "/api/", "/internal/", "/test/", "/__test/"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
