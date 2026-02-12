// PATH: src/features/videos/components/features/video-detail/components/AdminMemoSection.tsx
// 좌측 패널용 "관리자 메모" 전용 (시안: 영상 미리보기 아래)

interface Props {
  memo: string;
  setMemo: (v: string) => void;
}

export default function AdminMemoSection({ memo, setMemo }: Props) {
  return (
    <textarea
      value={memo}
      onChange={(e) => setMemo(e.target.value)}
      className="w-full min-h-[100px] rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-app)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      placeholder="관리자 메모"
    />
  );
}
