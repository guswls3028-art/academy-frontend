import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createLegacyStylesheets, legacyCssPlugin } from "../legacy-css.mjs";

test("old engines receive actual rules across shared cascade layers and lazy files", async () => {
  const outputs = await createLegacyStylesheets([
    { fileName: "assets/index-A.css", source: "@layer theme,base,components,utilities;@layer base{*:where(input,button){border:0}}" },
    { fileName: "assets/student-B.css", source: ".rich :where(pre code){padding:0}@layer utilities{.p-4{padding:1rem}}.student{display:flex;flex-direction:column;gap:12px}@media(width < 400px){.student{inset:0}}" },
  ]);
  const base = outputs.get("assets/index-A.css");
  const student = outputs.get("assets/student-B.css");
  assert.doesNotMatch(base + student, /@layer|:where\(|:is\(/);
  assert.match(base, /input/);
  assert.match(base, /button/);
  assert.match(student, /max-width:/);
  assert.match(student, /margin-top:\s*12px/);
  assert.match(student, /top:\s*0/);
  assert.match(student, /pre code/);
  assert.doesNotMatch(base, /\.student/);
  assert.doesNotMatch(student, /border:\s*0/);
});

test("legacy theme values stay tenant scoped and mobile layout has supported values", async () => {
  const outputs = await createLegacyStylesheets([{ fileName: "assets/index.css", source: ".student{--tint:color-mix(in srgb,var(--stu-primary) 8%,var(--stu-surface));color:color-mix(in srgb,var(--stu-text) 92%,black);height:100dvh;padding-bottom:env(safe-area-inset-bottom,0px);width:min(100%,460px);font-size:clamp(16px,4vw,24px);background:oklch(.8 .1 90)}" }]);
  const css = outputs.get("assets/index.css");
  assert.match(css, /--tint:\s*var\(--stu-surface\)/);
  assert.match(css, /color:\s*var\(--stu-text\)/);
  assert.match(css, /height:\s*100vh/);
  assert.match(css, /padding-bottom:\s*0px/);
  assert.match(css, /width:\s*100%/);
  assert.match(css, /max-width:\s*460px/);
  assert.doesNotMatch(css, /color-mix\(|oklch\(|clamp\(|min\(|env\(/);
});

test("Tailwind registered defaults exist without property registration", async () => {
  const outputs = await createLegacyStylesheets([{ fileName: "assets/index.css", source: '@property --tw-translate-x{syntax:"*";inherits:false;initial-value:0}.translate-x-1{--tw-translate-x:4px}' }]);
  const css = outputs.get("assets/index.css");
  assert.doesNotMatch(css, /@property/);
  assert.match(css, /--tw-translate-x:\s*0/);
  assert.match(css, /--tw-translate-x:\s*4px/);
});

test("responsive flex direction moves the legacy gap to the vertical axis", async () => {
  const outputs = await createLegacyStylesheets([{ fileName: "index.css", source: ".actions{display:flex;gap:12px}@media(max-width:400px){.actions{flex-direction:column}}" }]);
  const css = outputs.get("index.css");
  assert.match(css, /margin-left:\s*12px/);
  const mobile = css.slice(css.indexOf("@media"));
  assert.match(mobile, /margin-left:\s*0/);
  assert.match(mobile, /margin-top:\s*12px/);
});

test("Vite legacy injection becomes a cached stylesheet instead of inline modern CSS", async () => {
  const plugin = legacyCssPlugin("release-a");
  plugin.configResolved({ base: "/" });
  const css = "@layer base{button{padding:12px}}";
  const injected = `var __vite_style__ = document.createElement('style');__vite_style__.textContent = ${JSON.stringify(css)};document.head.appendChild(__vite_style__);console.log('ready');`;
  const chunk = { type: "chunk", name: "index", fileName: "assets/index-legacy-ABC.js", code: "" };
  const transformed = plugin.renderChunk(injected, chunk);
  assert.doesNotMatch(transformed.code, /textContent|@layer/);
  assert.match(transformed.code, /rel='stylesheet'/);
  assert.match(transformed.code, /assets\/index-[a-f0-9]{12}-legacy\.css/);
  assert.match(transformed.code, /console\.log\('ready'\)/);
  const emitted = [];
  await plugin.generateBundle.call({ emitFile: (asset) => emitted.push(asset) }, {}, { entry: chunk });
  assert.equal(emitted.length, 1);
  assert.match(emitted[0].source, /button/);
  assert.doesNotMatch(emitted[0].source, /@layer/);
});

test("a sibling stylesheet's layer change cannot reuse a prior release's CSS URL", async () => {
  const same = { fileName: "same.css", source: "@layer base{.same{color:red}}" };
  const before = await createLegacyStylesheets([same, { fileName: "other.css", source: "@layer base{.other{color:red}}" }]);
  const after = await createLegacyStylesheets([same, { fileName: "other.css", source: "@layer base{#other .specific{color:red}}" }]);
  assert.notEqual(before.get("same.css"), after.get("same.css"), "global specificity affects unchanged local CSS");
  const injected = `var __vite_style__ = document.createElement('style');__vite_style__.textContent = ${JSON.stringify(same.source)};document.head.appendChild(__vite_style__);`;
  const chunk = { name: "same", fileName: "assets/same-legacy.js" };
  const first = legacyCssPlugin("release-a").renderChunk(injected, chunk).code;
  const next = legacyCssPlugin("release-b").renderChunk(injected, chunk).code;
  assert.notEqual(first, next, "new compilation revision must change the immutable URL");
});

test("YouTube legacy ratio has normal, theater and fullscreen height behavior", async () => {
  const css = await readFile(new URL("../../src/app_student/domains/video/playback/player/player.css", import.meta.url), "utf8");
  assert.match(css, /@supports not \(aspect-ratio: 16 \/ 9\)/);
  assert.match(css, /\.svpYoutubeFrame::before\s*\{[^}]*padding-top:\s*56\.25%/);
  assert.match(css, /\.svpTheater \.svpYoutubeFrame::before\s*\{[^}]*padding-top:\s*42\.857143%/);
  assert.match(css, /\.svpPlayerWrap--fullscreen \.svpYoutubeFrame::before\s*\{[^}]*display:\s*none/);
});
