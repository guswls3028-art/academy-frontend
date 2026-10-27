/** Blob.arrayBuffer is absent on older Safari, including inside workers. */
export function readBlobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(reader.result) : reject(new Error("File could not be read"));
    reader.onerror = () => reject(reader.error ?? new Error("File could not be read"));
    reader.onabort = () => reject(new DOMException("File read cancelled", "AbortError"));
    reader.readAsArrayBuffer(blob);
  });
}
