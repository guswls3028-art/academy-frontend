// src/features/videos/api/uploadToR2.ts

export function uploadToR2(
  uploadUrl: string,
  file: File,
  contentType: string, // upload/init에서 받은 content_type
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl, true);

    // ✅ presign에서 Content-Type을 서명에 포함했으면 반드시 동일해야 함.
    // ✅ 반대로 presign이 Content-Type 없이 발급됐다면 헤더를 넣으면 403이 날 수 있음.
    // => init.content_type이 내려온 경우에만 넣음.
    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("R2 upload network error"));

    xhr.send(file);
  });
}
