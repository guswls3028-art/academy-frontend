// PATH: src/app_admin/domains/storage/components/matchup/HitReportEditor.parts/SelectionPanel.tsx
// 우측 후보 선택 패널 + 행/dangling placeholder.
// 클릭 = active(미리보기 변경) / 명시 버튼 = PDF 포함 토글 / 원본 다시 자르기 진입.
/* eslint-disable no-restricted-syntax */

import { AlertTriangle, Crop } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import type { HitReportExamProblem } from "../../../api/matchup.api";
import {
  classifyMatch,
  TIER_COLOR,
  type CandidateMeta,
  type Tier,
} from "./types";

export function SelectionPanel({
  active, activeCandidateId, selectedIds, candidateMap,
  onToggle, onSetActive, onEditSource, disabled,
}: {
  active: HitReportExamProblem | null;
  activeCandidateId: number | null;
  selectedIds: number[];
  candidateMap: Map<number, CandidateMeta>;
  onToggle: (id: number) => void;
  onSetActive: (id: number) => void;
  onEditSource: (docId: number, docTitle: string) => void;
  disabled: boolean;
}) {
  if (!active) return null;
  const selectedSet = new Set(selectedIds);
  const extraSelected = selectedIds.filter(
    (pid) => !active.candidates.some((c) => c.id === pid),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{
        padding: "10px 12px", borderBottom: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)", flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>
            내 수업 자료 후보 ({active.candidates.length})
          </span>
          {selectedIds.length > 0 && (
            <span style={{
              padding: "1px 7px", borderRadius: 999,
              background: "var(--color-brand-primary)", color: "white",
              fontSize: 10, fontWeight: 700,
            }}>
              {selectedIds.length} 선택
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
          행 클릭 = 미리보기 / "+ PDF에 추가" 버튼 = 보고서에 포함
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
        {active.candidates.length === 0 && extraSelected.length === 0 ? (
          <div style={{
            padding: 16, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 12,
            background: "var(--color-bg-surface-soft)",
            border: "1px dashed var(--color-border-divider)",
            borderRadius: 6, lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: "var(--color-text-primary)" }}>
              유사 자료가 없습니다
            </div>
            <div style={{ fontSize: 11 }}>
              매치업 페이지에서 자료를 매뉴얼 크롭/paste로 추가하면 자동 매칭됩니다.
            </div>
          </div>
        ) : null}
        {active.candidates.map((c) => (
          <SelectRow
            key={c.id}
            isActive={c.id === activeCandidateId}
            isSelected={selectedSet.has(c.id)}
            disabled={disabled}
            onClick={() => onSetActive(c.id)}
            onToggle={() => onToggle(c.id)}
            onEditSource={() => onEditSource(
              c.document_id,
              c.document_title || `자료 ${c.document_id}번`,
            )}
            imageUrl={c.image_url}
            docTitle={c.document_title || `자료 ${c.document_id}번`}
            docMeta={[
              `Q${c.number}`,
              c.document_category,
              `자료 ${c.document_id}번`,
            ].filter(Boolean).join("  ·  ")}
            meta={`유사도 ${(c.similarity * 100).toFixed(1)}%`}
            tier={classifyMatch(c.similarity)}
            text={c.text_preview}
          />
        ))}
        {extraSelected.length > 0 && (
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: "1px dashed var(--color-border-divider)",
          }}>
            <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 6, fontWeight: 600 }}>
              사용자 선택 (자동 후보 외)
            </div>
            {extraSelected.map((pid) => {
              const meta = candidateMap.get(pid);
              if (!meta) {
                return (
                  <DanglingRow
                    key={pid}
                    pid={pid}
                    disabled={disabled}
                    onRemove={() => onToggle(pid)}
                  />
                );
              }
              const docTitle = ("document_title" in meta && meta.document_title)
                ? meta.document_title
                : `자료 ${meta.document_id}번`;
              const docCategory = ("document_category" in meta) ? meta.document_category : "";
              return (
                <SelectRow
                  key={pid}
                  isActive={pid === activeCandidateId}
                  isSelected={true}
                  disabled={disabled}
                  onClick={() => onSetActive(pid)}
                  onToggle={() => onToggle(pid)}
                  onEditSource={() => onEditSource(meta.document_id, docTitle)}
                  imageUrl={meta.image_url}
                  docTitle={docTitle}
                  docMeta={[
                    `Q${meta.number}`,
                    docCategory,
                    `자료 ${meta.document_id}번`,
                  ].filter(Boolean).join("  ·  ")}
                  meta="수동 추가"
                  tier="miss"
                  text={meta.text_preview}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectRow({
  isActive, isSelected, disabled, onClick, onToggle, onEditSource,
  imageUrl, docTitle, docMeta, meta, tier, text,
}: {
  isActive: boolean;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
  onToggle: () => void;
  onEditSource: () => void;
  imageUrl?: string;
  docTitle: string;
  docMeta: string;
  meta: string;
  tier: Tier;
  text: string;
}) {
  const tierColor = TIER_COLOR[tier];
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        position: "relative",
        display: "flex", alignItems: "stretch", gap: 8,
        padding: 6, paddingLeft: 12, marginBottom: 6,
        border: `2px solid ${isActive ? "var(--color-brand-primary)" : (isSelected ? "color-mix(in srgb, var(--color-status-success) 30%, transparent)" : "transparent")}`,
        borderRadius: 6,
        background: isSelected
          ? "color-mix(in srgb, var(--color-status-success) 6%, var(--color-bg-canvas))"
          : isActive
            ? "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)"
            : "var(--color-bg-canvas)",
        cursor: "pointer",
        boxShadow: isActive ? "0 1px 4px rgba(37,99,235,0.15)" : "none",
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      {isSelected && (
        <span aria-hidden style={{
          position: "absolute", left: 0, top: 6, bottom: 6, width: 4,
          borderRadius: "0 3px 3px 0",
          background: "var(--color-status-success)",
        }} />
      )}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={docTitle}
          title={`${docTitle} · ${docMeta}`}
          style={{
            width: 80, height: 100, objectFit: "contain",
            objectPosition: "top center",
            borderRadius: 3, background: "white",
            border: "1px solid var(--color-border-divider)", flexShrink: 0,
          }}
        />
      ) : (
        <div style={{
          width: 80, height: 100, borderRadius: 3, flexShrink: 0,
          background: "var(--color-bg-surface-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-text-muted)", fontSize: 10,
        }}>
          이미지 없음
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            title={docTitle}
            style={{
              fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)",
              minWidth: 0, flex: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {docTitle}
          </span>
          {isSelected && (
            <span aria-label="PDF에 포함됨" style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px",
              borderRadius: 3, background: "var(--color-status-success)",
              color: "white", flexShrink: 0,
            }}>
              ✓ PDF
            </span>
          )}
        </div>
        <div style={{
          fontSize: 10, color: "var(--color-text-muted)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {docMeta}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: tier === "miss" ? "var(--color-text-muted)" : tierColor,
        }}>
          {meta}
        </div>
        <div style={{
          fontSize: 11, color: "var(--color-text-secondary)",
          maxHeight: 48, overflow: "hidden",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
        }}>
          {text}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            disabled={disabled}
            aria-label={isSelected ? "PDF에서 제외" : "PDF에 포함"}
            style={{
              padding: "4px 10px",
              fontSize: 11, fontWeight: 700,
              border: `1px solid ${isSelected ? "var(--color-status-success)" : "var(--color-brand-primary)"}`,
              borderRadius: 4,
              background: isSelected
                ? "color-mix(in srgb, var(--color-status-success) 12%, white)"
                : "var(--color-brand-primary)",
              color: isSelected ? "var(--color-status-success)" : "white",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {isSelected ? "✕ PDF에서 제외" : "+ PDF에 추가"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEditSource(); }}
            disabled={disabled}
            aria-label="원본 자료에서 이 문항 다시 자르기"
            title="자료가 거의 같은데 잘린 게 애매해 못 쓸 때 — 원본 페이지로 즉시 점프"
            style={{
              padding: "4px 8px",
              fontSize: 11, fontWeight: 600,
              border: "1px solid var(--color-border-divider)",
              borderRadius: 4,
              background: "transparent",
              color: "var(--color-text-secondary)",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.5 : 1,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <Crop size={ICON.xs} />
            원본 다시 자르기
          </button>
        </div>
      </div>
    </div>
  );
}

// dangling 후보 placeholder — 보고서 저장 후 원본 자료가 삭제·재처리되어 candidateMap
// 에서 사라진 problem id 를 시각적으로 명시. 이전엔 silent omit 이라 사용자가 "내가
// 17개 골랐는데 12개만 보이지?" 인지 못 했음 (2026-05-06 dangling 사고 ref).
function DanglingRow({
  pid, disabled, onRemove,
}: {
  pid: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div
      data-testid="matchup-hit-report-dangling-row"
      style={{
        display: "flex", alignItems: "stretch", gap: 8,
        padding: 6, paddingLeft: 12, marginBottom: 6,
        border: "2px dashed color-mix(in srgb, var(--color-status-error, #dc2626) 35%, transparent)",
        borderRadius: 6,
        background: "color-mix(in srgb, var(--color-status-error, #dc2626) 4%, var(--color-bg-canvas))",
      }}
    >
      <div style={{
        width: 80, height: 100, borderRadius: 3, flexShrink: 0,
        background: "color-mix(in srgb, var(--color-status-error, #dc2626) 6%, var(--color-bg-surface-soft))",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--color-status-error, #dc2626)",
      }}>
        <AlertTriangle size={ICON.lg} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: "var(--color-status-error, #dc2626)",
        }}>
          원본 자료가 삭제되었습니다
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          이전에 선택했던 자료(번호 {pid})를 더 이상 찾을 수 없어 PDF에 포함되지 않습니다. 이 자리는 다른 자료로 교체하거나 제거해 주세요.
        </div>
        <div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (!disabled) onRemove(); }}
            disabled={disabled}
            style={{
              padding: "4px 10px",
              fontSize: 11, fontWeight: 700,
              border: "1px solid color-mix(in srgb, var(--color-status-error, #dc2626) 35%, transparent)",
              borderRadius: 4,
              background: "color-mix(in srgb, var(--color-status-error, #dc2626) 8%, transparent)",
              color: "var(--color-status-error, #dc2626)",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            선택에서 제거
          </button>
        </div>
      </div>
    </div>
  );
}
