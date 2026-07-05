// PATH: src/app_admin/domains/tools/ppt/pptFileSize.ts

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

export function pptBytesText(bytes: number, options: { includeGb?: boolean } = {}): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (options.includeGb !== false && bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

export function pptMegabytesText(bytes: number): string {
  return `${(bytes / MB).toFixed(1)}MB`;
}
