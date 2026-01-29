// src/features/videos/pages/VideoDetail.styles.ts

export const styles = {
  page: {
    subtitle: "text-sm text-gray-600 mb-6",
    subtitleTitle: "font-medium text-gray-700 mr-2",
  },

  layout: {
    root: "flex gap-6",
    left: "flex flex-col gap-4 w-[750px]",
  },

  modeToggle: {
    wrapper: "rounded border bg-white p-3 flex items-center justify-between",
    button: (active: boolean) =>
      `text-xs px-3 py-1 rounded border ${
        active ? "bg-white font-semibold" : "bg-gray-100"
      }`,
    hint: "text-[11px] text-gray-500",
    selectedStudent: "ml-2 text-[11px] text-gray-600",
  },

  player: {
    container: "rounded border bg-white p-4",
    empty: "text-sm text-gray-600",
  },

  policyPanel: {
    wrapper: "rounded border bg-white p-4 text-sm space-y-3",
    title: "font-semibold",
    saveButton: (dirty: boolean) =>
      `ml-auto rounded px-4 py-1.5 text-xs font-semibold text-white ${
        dirty
          ? "bg-blue-600 hover:bg-blue-700"
          : "bg-gray-400 cursor-not-allowed"
      }`,
  },
};
