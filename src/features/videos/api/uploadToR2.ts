// PATH: src/features/videos/api/uploadToR2.ts

export function uploadToR2(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!uploadUrl) {
      reject(new Error("uploadUrl is empty"));
      return;
    }

    const xhr = new XMLHttpRequest();

    try {
      xhr.open("PUT", uploadUrl, true);
    } catch (e) {
      reject(new Error("Failed to open XHR"));
      return;
    }

    if (contentType) {
      try {
        xhr.setRequestHeader("Content-Type", contentType);
      } catch {
        // presigned URL may forbid setting headers
      }
    }

    xhr.timeout = 60_000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.max(
          0,
          Math.min(100, Math.round((e.loaded / e.total) * 100))
        );
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(`R2 upload failed: ${xhr.status} ${xhr.statusText}`)
        );
      }
    };

    xhr.onerror = () => reject(new Error("R2 upload network error"));
    xhr.ontimeout = () => reject(new Error("R2 upload timeout"));
    xhr.onabort = () => reject(new Error("R2 upload aborted"));

    try {
      xhr.send(file);
    } catch (e) {
      reject(new Error("R2 upload send failed"));
    }
  });
}
