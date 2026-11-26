import { createContext, useContext } from "react";

type VideoUploadDialogs = {
  open: (sessionId: number, folderId?: number | null) => void;
  findReopenAction: (batchId?: string) => (() => void) | undefined;
};

export const VideoUploadDialogsContext = createContext<VideoUploadDialogs | null>(null);

export function useVideoUploadDialogs() {
  const dialogs = useContext(VideoUploadDialogsContext);
  if (!dialogs) throw new Error("Video upload requires the staff workspace");
  return dialogs;
}
