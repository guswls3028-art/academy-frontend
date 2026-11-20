export function isPhotoFile(filename: string, mimeType?: string | null): boolean {
  const type = mimeType?.trim().toLowerCase();
  if (type && type !== "application/octet-stream") return type.startsWith("image/");
  return /\.(?:avif|bmp|gif|hei[cf]|jpe?g|png|webp)$/i.test(filename);
}

export function isHeicPhoto(filename: string, mimeType?: string | null): boolean {
  return /^image\/hei[cf](?:-sequence)?(?:;|$)/i.test(mimeType ?? "") || /\.hei[cf]$/i.test(filename);
}
