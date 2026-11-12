import "server-only";
export const json = (v: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
export async function body<T>(req: Request): Promise<Partial<T>> { try { return (await req.json()) as Partial<T>; } catch { return {}; } }
