// PATH: src/app_teacher/shared/ui/MobileRichEditor.tsx
// 모바일 리치 텍스트 에디터 — shared TipTap RichTextEditor의 compact 래퍼
// 이전 버전은 document.execCommand(deprecated) 기반 — Batch 9에서 TipTap으로 교체
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
}

export default function MobileRichEditor({ value, onChange, placeholder, minHeight = 150, readOnly }: Props) {
  return (
    <RichTextEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? "내용을 입력하세요"}
      minHeight={minHeight}
      readOnly={readOnly}
      compact
    />
  );
}
