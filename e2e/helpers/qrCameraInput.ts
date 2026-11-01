import type { Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";

type CameraMode = "frame" | "denied" | "unavailable";
type CameraState = { requests: number; tracks: MediaStreamTrack[]; dispose: () => void };
type CameraWindow = Window & { __academyQrCameraInput?: CameraState };

/** Supply pixels only. The app's decoder, requests and saved results are never replaced. */
export async function withQrCameraInput(
  page: Page, photo: Buffer, action: () => Promise<void>, mode: CameraMode = "frame",
) {
  await page.evaluate(async ({ png, mode }) => {
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("QR camera fixture requires loopback");
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia || !HTMLCanvasElement.prototype.captureStream) {
      throw new Error("This browser cannot run the QR camera input fixture");
    }
    const scope = window as CameraWindow;
    if (scope.__academyQrCameraInput) throw new Error("QR camera input is already installed");
    const devices = navigator.mediaDevices;
    const descriptor = Object.getOwnPropertyDescriptor(devices, "getUserMedia");
    const image = new Image(); image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const timers = new Set<number>();
    const state: CameraState = {
      requests: 0, tracks: [],
      dispose: () => {
        for (const timer of timers) window.clearInterval(timer);
        for (const track of state.tracks) track.stop();
        if (descriptor) Object.defineProperty(devices, "getUserMedia", descriptor);
        else Reflect.deleteProperty(devices, "getUserMedia");
        delete scope.__academyQrCameraInput;
      },
    };
    Object.defineProperty(devices, "getUserMedia", {
      configurable: true,
      value: mode === "unavailable" ? undefined : async () => {
        state.requests += 1;
        if (mode === "denied") throw new DOMException("Camera permission denied by test input", "NotAllowedError");
        const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 640;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("QR camera canvas is unavailable");
        const paint = () => {
          context.fillStyle = "white"; context.fillRect(0, 0, 640, 640);
          context.drawImage(image, 120, 120, 400, 400);
        };
        paint();
        const stream = canvas.captureStream(8);
        const timer = window.setInterval(paint, 125);
        timers.add(timer);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => { window.clearInterval(timer); timers.delete(timer); stop(); };
          state.tracks.push(track);
        }
        return stream;
      },
    });
    scope.__academyQrCameraInput = state;
  }, { png: photo.toString("base64"), mode });
  try {
    await action();
    const requests = await page.evaluate(() => (window as CameraWindow).__academyQrCameraInput?.requests);
    if (mode === "unavailable") expect(requests).toBe(0);
    else expect(requests).toBeGreaterThan(0);
    if (mode === "frame") {
      expect(await page.evaluate(() => (window as CameraWindow).__academyQrCameraInput?.tracks.length)).toBeGreaterThan(0);
    }
    // Check the app stopped its tracks BEFORE the fixture's defensive cleanup.
    await expect.poll(() => page.evaluate(() => {
      const state = (window as CameraWindow).__academyQrCameraInput;
      return state ? state.tracks.filter((track) => track.readyState !== "ended").length : -1;
    }), { message: "QR decoder must release every camera track", timeout: 5_000 }).toBe(0);
  } finally {
    await page.evaluate(() => (window as CameraWindow).__academyQrCameraInput?.dispose());
  }
}
