// PATH: src/features/videos/pages/VideoDetail.styles.ts

export const styles = {
  page: {
    subtitle: "mt-1 text-sm text-[var(--text-muted)]",
  },

  layout: {
    root: "flex gap-10 items-start",
    left: "flex flex-col gap-8 w-[760px]",
    right: "w-[520px] shrink-0",
  },

  section: {
    /**
     * Admin / Staff canonical
     * - wrapper: surface + border + radius
     * - header: 책임 단위 제목
     * - body: 실제 조작 영역
     */
    wrapper: "bg-[var(--bg-surface)] rounded-xl border border-[var(--border-divider)]",

    header: "px-6 pt-5 pb-2 text-sm font-semibold text-[var(--text-primary)]",

    body: "px-6 pb-6 space-y-4",

    description: "text-xs text-[var(--text-muted)]",
  },

  header: {
    title: "text-xl font-semibold text-[var(--text-primary)]",
    actions: "flex items-center gap-2",
    backLink:
      "rounded border border-[var(--border-divider)] px-3 py-1.5 text-sm bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-soft)] transition",
  },
};
