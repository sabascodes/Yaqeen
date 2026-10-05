// Forwards the demo's hadith lookups to the Dorar hadith API (dorar.net, an approved source).
// Only the hadith text from the request is sent; nothing about the visitor is forwarded.
const MAX_WORDS = 12;

export default async (req: Request) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").split(/\s+/).filter(Boolean).slice(0, MAX_WORDS).join(" ");
  if (!q) return new Response("Bad request", { status: 400 });
  try {
    const res = await fetch(`https://dorar.net/dorar_api.json?skey=${encodeURIComponent(q)}`, {
      headers: { accept: "application/json", "user-agent": "YaqeenDemo/1.0 (+https://yaqeen-demo.netlify.app)" },
    });
    if (!res.ok) return new Response(`Dorar answered ${res.status}`, { status: 502 });
    return new Response(await res.text(), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=86400" },
    });
  } catch (e) {
    return new Response(`Dorar unreachable: ${e}`, { status: 502 });
  }
};

export const config = { path: "/api/dorar" };
