import { useEffect } from "react";

export default function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <div role="status" aria-live="polite">
      업데이트 소식으로 이동하고 있습니다.
    </div>
  );
}
