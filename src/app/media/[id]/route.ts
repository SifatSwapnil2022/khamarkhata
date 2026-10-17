import { getDb } from "@/db";
import { getMediaFile } from "@/server/media";

/**
 * Photos farms took of their animals. The id is a random UUID, the same as a photo link on any
 * CDN: anyone with the link can see the picture (marketplace listings need that), nobody can list them.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await getMediaFile(await getDb(), id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
