// PATH: src/app_admin/domains/storage/components/matchup/DocumentGuidanceBanner.tsx
//
// Stage 6.7-policy P0 1+2 — paper_type / processing_quality / indexable 통합 안내 배너.
//
// 목적: 학원장이 자동분리 결과를 처음 볼 때 "이 자료는 자동분리 사용 가능?
// 검수 필요? 수동 자르기 권장? 인덱스 제외?" 를 한 번에 알 수 있게.
//
// 원칙 (Stage 6.7-policy 보고서):
//   - 빨간색 남발 금지 (warning 톤 max, error 톤 X)
//   - "실패" 아닌 "권장 행동" 중심 copy
//   - clean_pdf_* + precise_split + indexable=True 인 일반 케이스는 조용한 info 1줄
//   - scan_* / student_answer_photo / quadrant 는 manual 우선 권장
//   - 9 paper_type + 5 quality + indexable 모두 cover
//
// 데이터 source: doc.meta.paper_type_summary.primary, processing_quality,
//                indexable, source_type (모두 callback 이 자동 set, frontend 변경 X)
//
// 기존 paper_type_summary.warnings banner (MatchupPage.tsx line 1311-) 와 별개:
//   - 기존 banner: warning enum (student_answer_photo_detected 등) 만 표시
//   - 본 banner: paper_type primary + quality + indexable 통합 (모든 doc 대상)

import { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, FileText, ImageOff } from "lucide-react";
import type { MatchupDocument } from "../../api/matchup.api";

type Tone = "success" | "info" | "warning" | "neutral";

type Guidance = {
  tone: Tone;
  icon: ReactNode;
  title: string;
  message: string;
  /** 권장 행동 hint — 사용자가 다음 클릭할 곳 (UI 자체는 다른 컴포넌트가 담당). */
  action?: string;
};

// paper_type 별 안내 (사용자 directive §2.2 copy 그대로).
function paperTypeGuidance(primary: string | undefined): Guidance | null {
  if (!primary) return null;
  switch (primary) {
    case "clean_pdf_dual":
    case "clean_pdf_single":
      return {
        tone: "success",
        icon: <CheckCircle2 size={18} />,
        title: "깨끗한 PDF로 판단되어 자동 문항분리를 사용할 수 있습니다.",
        message: "결과 확인 후 필요 시 수정해 주세요.",
      };
    case "scan_dual":
      return {
        tone: "warning",
        icon: <AlertTriangle size={18} />,
        title: "스캔본 2단형으로 판단되었습니다.",
        message: "자동분리는 가능하지만 제목·여백이 함께 잡힐 수 있어 검수가 필요합니다.",
        action: "결과를 확인하고 어색한 박스는 직접 잘라주세요.",
      };
    case "scan_single":
      return {
        tone: "warning",
        icon: <AlertTriangle size={18} />,
        title: "스캔본 단일형으로 판단되었습니다.",
        message: "필기·채점 흔적이 있으면 자동분리 정확도가 낮을 수 있어 수동 자르기를 권장합니다.",
        action: "수동 자르기로 시작하시는 게 더 빠를 수 있습니다.",
      };
    case "student_answer_photo":
      return {
        tone: "warning",
        icon: <AlertTriangle size={18} />,
        title: "학생 답안지/폰사진으로 판단되었습니다.",
        message: "종이 굴곡·그림자·필기 때문에 자동분리 정확도가 낮을 수 있어 수동 자르기를 권장합니다.",
        action: "수동 자르기로 시작하시는 게 더 정확합니다.",
      };
    case "quadrant":
      return {
        tone: "warning",
        icon: <AlertTriangle size={18} />,
        title: "4분할 자료로 판단되었습니다.",
        message: "아직 표본이 부족하므로 자동분리 결과를 반드시 검수해 주세요.",
        action: "결과가 어색하면 수동 자르기로 보정해 주세요.",
      };
    case "non_question":
      return {
        tone: "neutral",
        icon: <FileText size={18} />,
        title: "표지·정답지·해설지로 판단되어 매칭 인덱싱 대상이 아닐 수 있습니다.",
        message: "출제본 PDF가 따로 있다면 해당 자료를 업로드하시는 것을 권장드립니다.",
      };
    case "side_notes":
      return {
        tone: "info",
        icon: <Info size={18} />,
        title: "학습자료 본문으로 판단되었습니다.",
        message: "본문 항목번호 기반 자동분리를 진행했습니다. 결과를 검수해 주세요.",
      };
    case "unknown":
    default:
      return {
        tone: "warning",
        icon: <AlertTriangle size={18} />,
        title: "자료 유형을 확정하지 못했습니다.",
        message: "자동분리 결과를 확인하고 필요 시 수동 자르기를 사용해 주세요.",
      };
  }
}

// 5단계 processing_quality 안내 (사용자 directive §3 copy 그대로).
function qualityGuidance(quality: string | undefined): Guidance | null {
  if (!quality) return null;
  switch (quality) {
    case "precise_split":
      return {
        tone: "success",
        icon: <CheckCircle2 size={18} />,
        title: "자동분리가 안정적으로 완료되었습니다.",
        message: "",
      };
    case "coarse_split":
      return {
        tone: "info",
        icon: <Info size={18} />,
        title: "자동분리는 완료되었지만 일부 문항 경계가 넓을 수 있습니다.",
        message: "결과를 살펴보시고 필요한 부분만 직접 다듬어 주세요.",
      };
    case "needs_review":
      return {
        tone: "warning",
        icon: <AlertTriangle size={18} />,
        title: "검수가 필요한 자동분리 결과입니다.",
        message: "페이지 단위 폴백된 문항이 있어 직접 자르기 보강을 권장합니다.",
      };
    case "page_fallback":
      return {
        tone: "warning",
        icon: <AlertTriangle size={18} />,
        title: "문항 단위 분리에 실패해 페이지 단위로 처리되었습니다.",
        message: "수동 자르기로 진행해 주세요.",
      };
    case "no_problems":
      return {
        tone: "warning",
        icon: <AlertTriangle size={18} />,
        title: "문항을 찾지 못했습니다.",
        message: "자료 유형을 확인하시거나 수동 자르기로 추가해 주세요.",
      };
    default:
      return null;
  }
}

// indexable 상태 — false 시 명확하게 안내 (운영 의미 중심, 기술 용어 회피).
function indexableNotice(indexable: boolean | undefined): Guidance | null {
  if (indexable === false) {
    return {
      tone: "neutral",
      icon: <ImageOff size={18} />,
      title: "이 자료는 매치업 검색·비교 풀에서 제외된 상태입니다.",
      message: "검수 후 풀에 포함시키려면 결과를 다듬은 뒤 인덱싱 토글을 켜주세요.",
    };
  }
  return null;
}

const TONE_TO_STYLE: Record<Tone, { bg: string; border: string; fg: string }> = {
  success: {
    bg: "color-mix(in srgb, var(--color-status-success, #10b981) 6%, transparent)",
    border: "color-mix(in srgb, var(--color-status-success, #10b981) 30%, transparent)",
    fg: "var(--color-status-success, #10b981)",
  },
  info: {
    bg: "color-mix(in srgb, var(--color-brand-primary, #3b82f6) 6%, transparent)",
    border: "color-mix(in srgb, var(--color-brand-primary, #3b82f6) 25%, transparent)",
    fg: "var(--color-brand-primary, #3b82f6)",
  },
  warning: {
    bg: "color-mix(in srgb, var(--color-warning, #d97706) 8%, transparent)",
    border: "color-mix(in srgb, var(--color-warning, #d97706) 30%, transparent)",
    fg: "var(--color-warning, #d97706)",
  },
  neutral: {
    bg: "var(--color-bg-surface-soft, #f3f4f6)",
    border: "var(--color-border-divider, #e5e7eb)",
    fg: "var(--color-text-secondary, #6b7280)",
  },
};

type Props = {
  document: MatchupDocument | null | undefined;
};

/**
 * Stage 6.7 P0 — 자료 안내 통합 배너.
 *
 * 표시 정책:
 * - status !== "done": 안 띄움 (분석 진행 중 또는 실패)
 * - clean_pdf_* + precise_split + indexable=True: success 1줄 (조용)
 * - 그 외: paper_type / quality / indexable 중 의미 있는 안내만 노출
 * - 빨간색 사용 0
 */
export default function DocumentGuidanceBanner({ document }: Props) {
  if (!document || document.status !== "done") return null;
  const meta = document.meta ?? null;
  if (!meta) return null;

  const primary = meta.paper_type_summary?.primary;
  const quality = typeof meta.processing_quality === "string"
    ? meta.processing_quality
    : undefined;
  const indexable = meta.indexable;

  const items: Guidance[] = [];

  const ptg = paperTypeGuidance(primary);
  if (ptg) items.push(ptg);

  const qg = qualityGuidance(quality);
  // precise_split 의 success 메시지는 paper_type success 와 중복 — 중복 제거.
  if (qg && !(quality === "precise_split" && ptg?.tone === "success")) {
    items.push(qg);
  }

  const ig = indexableNotice(indexable);
  if (ig) items.push(ig);

  if (items.length === 0) return null;

  return (
    <div
      data-testid="document-guidance-banner"
      data-paper-type={primary ?? ""}
      data-quality={quality ?? ""}
      data-indexable={indexable === false ? "false" : "true"}
      style={/* eslint-disable-line no-restricted-syntax */ {
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      {items.map((g, i) => {
        const style = TONE_TO_STYLE[g.tone];
        return (
          <div
            key={`${g.tone}-${i}`}
            data-testid={`document-guidance-${g.tone}`}
            style={/* eslint-disable-line no-restricted-syntax */ {
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              background: style.bg,
              border: `1px solid ${style.border}`,
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-3)",
            }}
          >
            <span style={/* eslint-disable-line no-restricted-syntax */ {
              color: style.fg, flexShrink: 0, marginTop: 2,
              display: "inline-flex",
            }}>
              {g.icon}
            </span>
            <div style={/* eslint-disable-line no-restricted-syntax */ { flex: 1, minWidth: 0 }}>
              <div style={/* eslint-disable-line no-restricted-syntax */ {
                fontSize: 13,
                fontWeight: 700,
                color: style.fg,
                marginBottom: g.message ? 4 : 0,
              }}>
                {g.title}
              </div>
              {g.message && (
                <div style={/* eslint-disable-line no-restricted-syntax */ {
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.5,
                }}>
                  {g.message}
                </div>
              )}
              {g.action && (
                <div style={/* eslint-disable-line no-restricted-syntax */ {
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  marginTop: 4,
                  fontStyle: "italic",
                }}>
                  → {g.action}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
