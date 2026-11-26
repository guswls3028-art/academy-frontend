import { lazy, Suspense, useState } from "react";
import { Outlet } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { createRandomUuid } from "@/shared/utils/randomUuid";
import { VideoUploadDialogsContext } from "@/shared/media/video/videoUploadDialogs";

const VideoUploadModal = lazy(() => import("./components/features/video-detail/modals/VideoUploadModal"));

type Batch = {
  id: string;
  sessionId: number;
  folderId: number | null;
  visible: boolean;
  presentation: number;
};

function UploadDialogs() {
  const [batches, setBatches] = useState<Batch[]>([]);
  function show(id: string) {
    // Remount only the visible window so its minimize control also gets restored.
    setBatches(previous => previous.map(batch => batch.id === id
      ? { ...batch, visible: true, presentation: batch.presentation + 1 }
      : batch));
  }
  function open(sessionId: number, folderId: number | null = null) {
    const id = createRandomUuid();
    setBatches(previous => [...previous, { id, sessionId, folderId, visible: true, presentation: 0 }]);
  }
  function close(id: string, keepTransferring = false) {
    setBatches(previous => keepTransferring
      ? previous.map(batch => batch.id === id ? { ...batch, visible: false } : batch)
      : previous.filter(batch => batch.id !== id));
  }

  return (
    <VideoUploadDialogsContext.Provider value={{
      open,
      findReopenAction: id => id && batches.some(batch => batch.id === id) ? () => show(id) : undefined,
    }}>
      <Outlet />
      <Suspense fallback={null}>
        {batches.map(batch => (
          <VideoUploadModal
            key={batch.id}
            batchId={batch.id}
            sessionId={batch.sessionId}
            folderId={batch.folderId}
            isOpen={batch.visible}
            presentation={batch.presentation}
            onClose={keepTransferring => close(batch.id, keepTransferring)}
          />
        ))}
      </Suspense>
    </VideoUploadDialogsContext.Provider>
  );
}

export default function VideoUploadWorkspace() {
  const { user } = useAuth();
  return <UploadDialogs key={JSON.stringify([getTenantCodeForApiRequest(), user?.id])} />;
}
