import { generateAdsTxtContent } from "@/config/ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = generateAdsTxtContent();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
