export const publicVideoQueryKeys = {
  publisher: (tenant: string | null, userId: number | undefined) =>
    ["landing-video-publisher", tenant, userId] as const,
};
