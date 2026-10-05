// Builds the web demo into demo-dist/ (deployed to Netlify, see ../netlify.toml).
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const out = "demo-dist";
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "data"), { recursive: true });

await build({
  entryPoints: { demo: "demo/demo.ts" },
  outdir: out,
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  logLevel: "info",
});
cpSync("demo/index.html", join(out, "index.html"));
cpSync("demo/favicon.png", join(out, "favicon.png"));
cpSync("src/ui/card.css", join(out, "ui.css"));
for (const f of ["quran.json", "hadeethenc.json"]) {
  // Source data from backend/data (made by fetch_quran.py and build_hadith.py).
  const src = join("..", "backend", "data", f);
  if (!existsSync(src)) throw new Error(`${src} is missing; run fetch_quran.py and build_hadith.py first.`);
  cpSync(src, join(out, "data", f));
}
console.log("Built demo in", out);
