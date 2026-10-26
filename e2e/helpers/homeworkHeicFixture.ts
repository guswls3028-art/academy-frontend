import { readFileSync } from "node:fs";

// Synthetic 640x360 RGB image encoded with libheif; no user media or metadata.
export const homeworkHeic = readFileSync(new URL("../fixtures/files/homework.heic", import.meta.url));
export const homeworkHeicDataUrl = `data:image/heic;base64,${homeworkHeic.toString("base64")}`;
