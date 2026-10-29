"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CircularCarousel from "@/components/react-bits/CircularCarousel";
import { ToolRecord } from "@/types/tool";

type HomepageCarouselTool = Pick<ToolRecord, "slug" | "title" | "processingMode">;

function makeToolArtwork(format: string) {
  const artwork = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eef2ff"/><stop offset="1" stop-color="#dbeafe"/></linearGradient><linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs><rect width="640" height="440" rx="28" fill="url(#bg)"/><circle cx="524" cy="92" r="76" fill="#fff" fill-opacity=".55"/><circle cx="112" cy="352" r="108" fill="#fff" fill-opacity=".45"/><rect x="179" y="83" width="282" height="274" rx="28" fill="#fff"/><path d="M231 126h83l35 36v144a12 12 0 0 1-12 12h-94a12 12 0 0 1-12-12V138a12 12 0 0 1 12-12Z" fill="#f8fafc" stroke="#c7d2fe" stroke-width="8"/><path d="M314 126v36h35" fill="none" stroke="#c7d2fe" stroke-width="8"/><path d="M257 205h58m-58 32h72m-72 32h52" stroke="#94a3b8" stroke-width="10" stroke-linecap="round"/><rect x="331" y="240" width="124" height="62" rx="20" fill="url(#accent)"/><text x="393" y="280" fill="white" font-family="Arial,sans-serif" font-size="25" font-weight="700" text-anchor="middle">${format}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(artwork)}`;
}

function toCarouselItem(tool: HomepageCarouselTool) {
  const title = tool.title || tool.slug;
  const format = tool.slug.toUpperCase().replaceAll("-TO-", " → ").replaceAll("-", " ");
  const processing = tool.processingMode === "server" ? "Temporary server processing" : "Runs in your browser";

  return {
    src: makeToolArtwork(format),
    alt: `${format} file conversion illustration`,
    title,
    subtitle: processing,
    href: `/${tool.slug}`,
  };
}

export function HomepageToolCarousel({ tools }: { tools: HomepageCarouselTool[] }) {
  const router = useRouter();
  const items = tools.map(toCarouselItem);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = items[activeIndex] || items[0];

  if (!items.length) return null;

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
      <div className="mx-auto h-[300px] w-full max-w-2xl sm:h-[360px]">
        <CircularCarousel
          items={items}
          ariaLabel="Available FileNimble conversion tools"
          intro="none"
          autoplay="off"
          captions
          cardWidth={220}
          aspectRatio={1.35}
          fadeColor="#f7f8fc"
          onChange={setActiveIndex}
          onItemClick={(_, index) => router.push(items[index].href)}
          className="text-text-strong"
        />
      </div>

      <div className="min-w-0">
        <p className="text-sm leading-6 text-text-muted">
          Browse tools that are available now. Select a carousel item or use the links below to open a tool.
        </p>
        {selected && (
          <Link
            href={selected.href}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Open {selected.title}
            <span aria-hidden="true">→</span>
          </Link>
        )}
        <ul className="mt-6 grid gap-2 border-t border-border-subtle pt-4 text-sm sm:grid-cols-2 lg:grid-cols-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex min-h-10 items-center rounded-md text-text-strong underline decoration-border-subtle underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
