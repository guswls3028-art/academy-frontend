// PATH: src/features/storage/utils/imageCompress.ts
// 이미지 WebP 압축 (브라우저 단)

const DEFAULT_QUALITY = 0.85;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;

/**
 * 이미지 파일을 WebP로 압축하여 Blob 반환.
 * 지원 불가 시 원본 반환.
 */
export async function compressImageToWebP(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const r = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
          resolve(new File([blob], name, { type: "image/webp" }));
        },
        "image/webp",
        DEFAULT_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
