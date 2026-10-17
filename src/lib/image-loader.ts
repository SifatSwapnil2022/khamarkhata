/**
 * next/image loader. Unsplash and Pexels photos are resized by their own CDNs (as both sites ask),
 * so we only set the width and quality on the URL. Anything else is served as-is.
 */
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(quality ?? 70));
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    return url.toString();
  }
  if (src.startsWith("https://images.pexels.com/")) {
    const url = new URL(src);
    url.searchParams.set("auto", "compress");
    url.searchParams.set("cs", "tinysrgb");
    url.searchParams.set("w", String(width));
    return url.toString();
  }
  // Our own photos ship in two sizes: a 960px one for phones and the full one.
  if (src.startsWith("/photos/") && width <= 960 && !src.includes("-960.")) return src.replace(/\.jpg$/, "-960.jpg");
  return src;
}
