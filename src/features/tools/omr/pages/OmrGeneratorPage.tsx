// PATH: src/features/tools/omr/pages/OmrGeneratorPage.tsx
// OMR 답안지 생성 도구 — /admin/tools/omr

import { useRef, useState } from "react";
import { Button } from "@/shared/ui/ds";
import { resolveTenantCode, getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";

function getTenantLogoUrl(): string {
  const r = resolveTenantCode();
  if (!r.ok) return "/omr-default-logo.svg";
  const id = getTenantIdFromCode(r.code);
  if (!id) return "/omr-default-logo.svg";
  const b = getTenantBranding(id);
  return b?.logoUrl || "/omr-default-logo.svg";
}

export default function OmrGeneratorPage() {
  const [examName, setExamName] = useState("제1회 단원평가");
  const [lectureName, setLectureName] = useState("수학");
  const [sessionName, setSessionName] = useState("1차시");
  const [mcCount, setMcCount] = useState(20);
  const [essayCount, setEssayCount] = useState(5);
  const [choices, setChoices] = useState(5);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const buildUrl = () => {
    const logoUrl = getTenantLogoUrl();
    const params = new URLSearchParams({
      exam: examName,
      lecture: lectureName,
      session: sessionName,
      mc: String(mcCount),
      essay: String(essayCount),
      choices: String(choices),
      logo: logoUrl,
    });
    return `/omr-sheet.html?${params.toString()}`;
  };

  const handleGenerate = () => {
    if (iframeRef.current) {
      iframeRef.current.src = buildUrl();
    }
  };

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleOpenNew = () => {
    window.open(buildUrl(), "_blank");
  };

  return (
    <div className="flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
      {/* ── 설정 패널 ── */}
      <div className="w-[280px] flex-shrink-0 space-y-4">
        <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">시험 정보</div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">시험명</label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              placeholder="제1회 단원평가"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">강의명</label>
            <input
              type="text"
              value={lectureName}
              onChange={(e) => setLectureName(e.target.value)}
              className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              placeholder="선택 입력"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">차시명</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              placeholder="선택 입력"
            />
          </div>
        </section>

        <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">문항 설정</div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[var(--text-muted)] mb-1">객관식</label>
              <input
                type="number"
                min={0}
                max={45}
                value={mcCount}
                onChange={(e) => setMcCount(Number(e.target.value) || 0)}
                className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[var(--text-muted)] mb-1">서술형</label>
              <input
                type="number"
                min={0}
                max={10}
                value={essayCount}
                onChange={(e) => setEssayCount(Number(e.target.value) || 0)}
                className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">보기 수</label>
            <select
              value={choices}
              onChange={(e) => setChoices(Number(e.target.value))}
              className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
            >
              <option value={4}>4지선다</option>
              <option value={5}>5지선다</option>
            </select>
          </div>
        </section>

        <div className="space-y-2">
          <Button type="button" intent="primary" size="md" className="w-full" onClick={handleGenerate}>
            답안지 생성
          </Button>
          <Button type="button" intent="secondary" size="md" className="w-full" onClick={handlePrint}>
            인쇄 / PDF 저장
          </Button>
          <Button type="button" intent="ghost" size="sm" className="w-full" onClick={handleOpenNew}>
            새 탭에서 열기
          </Button>
        </div>

        <div className="rounded bg-[var(--bg-surface-soft)] p-3 text-xs text-[var(--text-muted)] leading-relaxed">
          <b>사용 안내</b><br />
          1. 시험 정보와 문항 수를 입력하세요.<br />
          2. "답안지 생성"을 클릭하면 미리보기가 갱신됩니다.<br />
          3. "인쇄 / PDF 저장"으로 출력하세요.<br />
          4. 시험 탭에서도 답안 등록 후 자동으로 OMR 출력 버튼이 나타납니다.
        </div>
      </div>

      {/* ── 미리보기 ── */}
      <div className="flex-1 rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] overflow-hidden">
        <iframe
          ref={iframeRef}
          src={buildUrl()}
          className="w-full h-full border-0"
          style={{ minHeight: 600 }}
          title="OMR 답안지 미리보기"
        />
      </div>
    </div>
  );
}
