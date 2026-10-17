import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve("guide-media-output");
const publicRoot = join(root, "package", "public", "guide-media");
const manifest = {};
const provenance = [];
const stamp = (seconds) => {
  const value = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(value / 3600000)).padStart(2, "0")}:${String(Math.floor(value / 60000) % 60).padStart(2, "0")}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}.${String(value % 1000).padStart(3, "0")}`;
};
const text = (value) => value.replace(/[<>&]/g, " ");

for (const directory of await readdir(root, { withFileTypes: true })) {
  if (!directory.isDirectory() || directory.name === "package") continue;
  const source = join(root, directory.name);
  const recording = JSON.parse(await readFile(join(source, "recording.json"), "utf8"));
  if (!recording.synthetic || recording.screens.length < 2 || !/^[a-z0-9-]+$/.test(recording.id)) throw new Error("Invalid guide recording");
  const hash = createHash("sha256");
  hash.update(await readFile(new URL(import.meta.url)));
  hash.update(JSON.stringify(recording.screens));
  for (const screen of recording.screens) hash.update(await readFile(join(source, screen.file)));
  hash.update(await readFile(recording.video));
  const assetFolder = `${recording.id}-${hash.digest("hex").slice(0, 12)}`;
  const output = join(publicRoot, assetFolder);
  await mkdir(output, { recursive: true });
  for (const screen of recording.screens) await cp(join(source, screen.file), join(output, screen.file));
  const videoPath = join(output, "walkthrough.mp4");
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", recording.video], { encoding: "utf8" }).trim());
  if (!Number.isFinite(duration) || duration < 5) throw new Error("Recording video is incomplete");
  const captions = recording.screens.map((screen, index) => {
    const from = index === 0 ? 0 : screen.at;
    const to = recording.screens[index + 1]?.at ?? duration;
    return `${stamp(from)} --> ${stamp(to)}\n${index + 1}. ${text(screen.title)}\n${text(screen.description)}\n`;
  }).join("\n");
  await writeFile(join(output, "captions.vtt"), `WEBVTT\n\n${captions}`, "utf8");
  // Keep the explanation outside the application pixels so it cannot cover Save or Next.
  const { width, height } = recording.viewport;
  const captionHeight = width < 500 ? 140 : 110;
  const assTime = (seconds) => stamp(seconds).replace(/^0/, "").slice(0, -1);
  const assText = (value) => text(value).replace(/[{}\\]/g, " ").replace(/\r?\n/g, " ");
  const events = recording.screens.map((screen, index) => {
    const from = index === 0 ? 0 : screen.at;
    const to = recording.screens[index + 1]?.at ?? duration;
    return `Dialogue: 0,${assTime(from)},${assTime(to)},Default,,0,0,0,,${index + 1}. ${assText(screen.title)}\\N${assText(screen.description)}`;
  }).join("\n");
  const subtitlePath = join(source, "captions.ass");
  await writeFile(subtitlePath, `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height + captionHeight}\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Noto Sans CJK KR,${width < 500 ? 17 : 24},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,20,20,14,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events}\n`);
  const subtitleFilterPath = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", recording.video,
    "-vf", `pad=iw:ih+${captionHeight}:0:0:color=0x101820,subtitles='${subtitleFilterPath}'`,
    "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", videoPath], { stdio: "inherit" });
  const url = `/guide-media/${assetFolder}`;
  const media = {
    title: recording.title,
    screens: recording.screens.map(({ file, title, description, alt }) => ({ src: `${url}/${file}`, title, description, alt })),
    video: { src: `${url}/walkthrough.mp4`, captions: `${url}/captions.vtt`, poster: `${url}/${recording.screens[0].file}`, duration: `${Math.ceil(duration)}초` },
  };
  for (const topic of recording.topics) {
    if (manifest[topic]) throw new Error(`Duplicate media topic: ${topic}`);
    manifest[topic] = media;
  }
  provenance.push({ id: recording.id, topics: recording.topics, sourceRevision: recording.sourceRevision, synthetic: true,
    viewport: recording.viewport, frames: recording.screens.length, durationSeconds: duration, folder: assetFolder });
}
if (provenance.length === 0) throw new Error("No completed guide recording");
await writeFile(join(root, "package", "guide-media.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(root, "package", "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
console.log(JSON.stringify({ recordings: provenance.length, topics: Object.keys(manifest).length, frames: provenance.reduce((total, item) => total + item.frames, 0) }));
