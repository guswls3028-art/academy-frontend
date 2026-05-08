// PATH: src/app_admin/domains/storage/components/matchup/BulkDeleteModal.tsx
//
// 자동분리 잔존 일괄삭제 모달 (A-2 2026-05-08).
//
// 이전: native window.prompt 두 단계 (입력 → confirm). 모바일/태블릿 viewport
// 미고정 + 디자인 시스템과 일관성 0 + 입력 중 실시간 피드백 부재.
//
// 신규: 디자인 시스템 토큰 + portal 백드롭 + 라이브 미리보기. 학원장이 "162" 만
// 입력해도 즉시 "162~maxNum 14개 삭제 (직접 자른 3개 자동 보호)" 가 노출되어
// 우발 손실 차단. 잘못 입력하면 빨간 인디케이터로 즉시 인지.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X, AlertTriangle, Shield } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import type { MatchupProblem } from "../../api/matchup.api";

type Props = {
  problems: MatchupProblem[];
  /** 확정 — 백엔드 호출은 호출부 책임. 모달은 입력 검증 + UX 만 담당. */
  onConfirm: (range: { numberFrom: number; numberTo: number }) => Promise<void> | void;
  onClose: () => void;
};

type ParseResult =
  | { ok: true; numberFrom: number; numberTo: number }
  | { ok: false; reason: string }
  | { ok: null };  // 빈 입력 — 에러 X, 단순 idle

function parseRange(input: string, maxNum: number): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: null };
  const m = trimmed.match(/^(\d+)\s*[-~]\s*(\d+)$/);
  if (m) {
    const from = parseInt(m[1], 10);
    const to = parseInt(m[2], 10);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
      return { ok: false, reason: "1 이상의 숫자를 입력해 주세요" };
    }
    if (from > to) return { ok: false, reason: "시작 번호가 끝 번호보다 큽니다" };
    return { ok: true, numberFrom: from, numberTo: to };
  }
  const single = parseInt(trimmed, 10);
  if (!Number.isInteger(single) || single < 1) {
    return { ok: false, reason: "예: 162 (단방향) 또는 150-200 (구간)" };
  }
  // 단방향 → maxNum 으로 상한 자동 강제. 학원장 우발 입력 안전망.
  return { ok: true, numberFrom: single, numberTo: maxNum };
}

export default function BulkDeleteModal({ problems, onConfirm, onClose }: Props) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { minNum, maxNum } = useMemo(() => {
    if (problems.length === 0) return { minNum: 1, maxNum: 1 };
    let mn = problems[0].number;
    let mx = problems[0].number;
    for (const p of problems) {
      if (p.number < mn) mn = p.number;
      if (p.number > mx) mx = p.number;
    }
    return { minNum: mn, maxNum: mx };
  }, [problems]);

  const parsed = useMemo(() => parseRange(input, maxNum), [input, maxNum]);

  const preview = useMemo(() => {
    if (!parsed || parsed.ok !== true) return null;
    const { numberFrom, numberTo } = parsed;
    const inRange = (n: number) => n >= numberFrom && n <= numberTo;
    const hits = problems.filter((p) => inRange(p.number));
    const manual = hits.filter((p) => Boolean(p.meta?.manual));
    const targets = hits.filter((p) => !p.meta?.manual);
    const targetNums = targets.map((p) => p.number).sort((a, b) => a - b);
    return {
      from: numberFrom,
      to: numberTo,
      targets,
      targetCount: targets.length,
      manualCount: manual.length,
      sampleHead: targetNums.slice(0, 5),
      sampleLast: targetNums.length > 5 ? targetNums[targetNums.length - 1] : null,
    };
  }, [parsed, problems]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const canSubmit = !!preview && preview.targetCount > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !preview) return;
    setSubmitting(true);
    try {
      await onConfirm({ numberFrom: preview.from, numberTo: preview.to });
      onClose();
    } catch {
      // onConfirm 이 throw 하면 모달 유지 — 사용자가 재시도 가능. 토스트는 호출부 책임.
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="자동분리 잔존 일괄삭제"
      onClick={submitting ? undefined : onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9500,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0, 0, 0, 0.45)",
        padding: "var(--space-4)",
      }}
    >
      <div
        data-testid="matchup-bulk-delete-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSubmit) {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT") {
              e.preventDefault();
              void handleSubmit();
            }
          }
        }}
        style={{
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          width: "min(520px, 100%)",
          maxHeight: "calc(100vh - 64px)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--color-border-divider)",
          display: "flex", alignItems: "center", gap: "var(--space-2)",
          flexShrink: 0,
        }}>
          <Trash2 size={ICON.md} style={{ color: "var(--color-danger)", flexShrink: 0 }} />
          <h3 style={{
            margin: 0, fontSize: 16, fontWeight: 700,
            color: "var(--color-text-primary)", flex: 1, minWidth: 0,
          }}>
            자동분리 잔존 일괄삭제
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="닫기"
            style={{
              background: "none", border: "none",
              color: "var(--color-text-secondary)",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.5 : 1,
              padding: 4, display: "flex",
            }}
          >
            <X size={ICON.md} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{
          padding: "var(--space-5)",
          overflowY: "auto",
          display: "flex", flexDirection: "column", gap: "var(--space-3)",
        }}>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            현재 자료 총 <strong>{problems.length}개</strong> 문항
            (번호 {minNum}~{maxNum}).
            <br />직접 자른 문항은 <strong>자동으로 보호</strong>됩니다.
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>
              삭제할 번호 범위
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="예: 162 (단방향)  또는  150-200 (구간)"
              data-testid="matchup-bulk-delete-input"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: 14,
                border: `1px solid ${
                  parsed && parsed.ok === false
                    ? "var(--color-danger)"
                    : preview && preview.targetCount > 0
                      ? "var(--color-brand-primary)"
                      : "var(--color-border-divider)"
                }`,
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg-surface)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
            <span style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              · 단방향 입력 시 <strong>{maxNum}</strong>까지 자동 적용됩니다.
            </span>
          </label>

          {/* 라이브 미리보기 — 입력하는 동안 실시간 노출 */}
          {parsed && parsed.ok === false && (
            <div
              data-testid="matchup-bulk-delete-error"
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-3)",
                background: "color-mix(in srgb, var(--color-danger) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
                borderRadius: "var(--radius-md)",
                fontSize: 12, color: "var(--color-danger)",
              }}
            >
              <AlertTriangle size={ICON.sm} />
              <span>{parsed.reason}</span>
            </div>
          )}

          {preview && (
            <div
              data-testid="matchup-bulk-delete-preview"
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: preview.targetCount > 0
                  ? "color-mix(in srgb, var(--color-warning) 6%, transparent)"
                  : "var(--color-bg-surface-soft)",
                border: `1px solid ${
                  preview.targetCount > 0
                    ? "color-mix(in srgb, var(--color-warning) 30%, transparent)"
                    : "var(--color-border-divider)"
                }`,
                borderRadius: "var(--radius-md)",
                display: "flex", flexDirection: "column", gap: "var(--space-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: preview.targetCount > 0
                    ? "var(--color-warning)"
                    : "var(--color-text-secondary)",
                }}>
                  {preview.from}~{preview.to}번 ·{" "}
                  {preview.targetCount > 0
                    ? `${preview.targetCount}개 삭제 예정`
                    : "삭제할 자동분리 문항이 없습니다"}
                </span>
              </div>

              {preview.targetCount > 0 && (
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                  대상 번호: {preview.sampleHead.join(", ")}
                  {preview.sampleLast !== null && `, ... ${preview.sampleLast}`}
                </div>
              )}

              {preview.manualCount > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, color: "var(--color-status-success)", fontWeight: 600,
                }}>
                  <Shield size={ICON.xs} />
                  직접 자른 {preview.manualCount}개 문항은 자동 보호됩니다
                </div>
              )}
            </div>
          )}

          <div style={{
            padding: "var(--space-2) var(--space-3)",
            background: "var(--color-bg-surface-soft)",
            border: "1px dashed var(--color-border-divider)",
            borderRadius: "var(--radius-sm)",
            fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.6,
          }}>
            ⚠ 이 작업은 되돌릴 수 없습니다.
          </div>
        </div>

        {/* 액션 */}
        <div style={{
          padding: "var(--space-3) var(--space-5)",
          borderTop: "1px solid var(--color-border-divider)",
          display: "flex", justifyContent: "flex-end", gap: "var(--space-2)",
          flexShrink: 0,
          background: "var(--color-bg-surface-soft)",
        }}>
          <Button
            intent="ghost"
            size="md"
            onClick={onClose}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            intent="danger"
            size="md"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="matchup-bulk-delete-confirm"
            leftIcon={<Trash2 size={ICON.sm} />}
          >
            {submitting
              ? "삭제 중…"
              : preview && preview.targetCount > 0
                ? `${preview.targetCount}개 삭제`
                : "삭제"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
