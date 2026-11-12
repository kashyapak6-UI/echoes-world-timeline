/** Public base path and static-export flag. Inlined at build time via NEXT_PUBLIC_*. Empty in local `next dev` / `next build`. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";
/** Prefix a root-relative public asset path (e.g. /data/events.json) with the Pages base path. */
export function asset(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${p}`;
}
