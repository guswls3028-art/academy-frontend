// PATH: src/app_admin/domains/videos/pages/VideoDetail.styles.ts
// 시안: 상단 헤더(제목+서브+설명, 우측 드롭다운) / 2컬럼(좌: 미리보기+정책+메모, 우: 현황+통계+버튼) / 하단 파일정보+통계

export const styles = {
  page: {
    subtitle: "mt-1 text-sm text-[var(--color-text-muted)]",
  },

  layout: {
    root: "grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8",
    left: "flex flex-col gap-6 min-w-0",
    right: "min-w-0 lg:sticky lg:top-4",
  },

  section: {
    wrapper: "bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-divider)] overflow-hidden",
    header: "m-0 border-b border-[var(--color-border-divider)] px-4 py-3.5 text-sm font-semibold text-[var(--color-text-primary)] sm:px-5 sm:py-4",
    body: "space-y-4 px-4 py-4 sm:px-5 sm:py-5",
    description: "text-xs text-[var(--color-text-muted)]",
  },

  header: {
    wrap: "flex flex-wrap items-start justify-between gap-4",
    title: "text-2xl font-bold text-[var(--color-text-primary)] tracking-tight",
    subtitle: "mt-1.5 text-sm text-[var(--color-text-secondary)]",
    description: "mt-0.5 text-xs text-[var(--color-text-muted)]",
    actions: "flex items-center gap-2 shrink-0",
    backLink:
      "rounded-lg border border-[var(--color-border-divider)] px-4 py-2 text-sm font-semibold bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-soft)] transition",
    primaryDropdown:
      "rounded-lg px-4 py-2 text-sm font-semibold bg-[var(--color-primary)] text-white hover:brightness-95 transition inline-flex items-center gap-2",
  },

  /** 하단 파일정보 / 통계 스트립 */
  bottom: {
    wrap: "mt-8 pt-6 border-t border-[var(--color-border-divider)] space-y-4",
    row: "flex flex-wrap items-center gap-6 text-xs text-[var(--color-text-secondary)]",
    label: "font-semibold text-[var(--color-text-primary)]",
  },

  /** 우측 현황 상단 KPI 카드 그리드 */
  kpiGrid: "grid grid-cols-3 gap-3",
};
