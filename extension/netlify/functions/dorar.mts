// Forwards the demo's hadith lookups to the Dorar hadith API (dorar.net, an approved source).
// Only the hadith text from the request is sent; nothing about the visitor is forwarded.
export default async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > 1000) return new Response("Bad request", { status: 400 });
  const res = await fetch(`https://dorar.net/dorar_api.json?skey=${encodeURIComponent(q)}`);
  if (!res.ok) return new Response("Dorar unavailable", { status: 502 });
  return new Response(await res.text(), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
};

export const config = { path: "/api/dorar" };
