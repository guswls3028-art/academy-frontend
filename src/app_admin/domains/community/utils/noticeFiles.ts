import { feedback } from "@/shared/ui/feedback/feedback";

export function selectNoticeFiles(current: File[], incoming: File[], existingCount = 0): File[] {
  const accepted = [...current];
  const errors = new Set<string>();
  for (const file of incoming) {
    const limit = file.type.startsWith("image/") ? 5 : 50;
    if (file.size > limit * 1024 * 1024) {
      errors.add(`${file.name}: ${limit}MB 이하 파일을 선택해 주세요.`);
    } else if (accepted.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
      errors.add("이미 선택한 파일은 한 번만 첨부됩니다.");
    } else if (existingCount + accepted.length >= 10) {
      errors.add("첨부파일은 기존 파일을 포함해 최대 10개까지 가능합니다.");
    } else {
      accepted.push(file);
    }
  }
  if (errors.size) feedback.warning([...errors].join("\n"));
  return accepted;
}
