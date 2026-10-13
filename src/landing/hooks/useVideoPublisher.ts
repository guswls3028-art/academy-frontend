import { useEffect, useState } from "react";
import useAuth from "@/auth/hooks/useAuth";
import { videoCapability } from "../api/publicVideos";

export function useVideoPublisher() {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<"loading" | "allowed" | "denied" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    if (!isAuthenticated) { setState("denied"); return; }
    setState("loading");
    videoCapability().then((allowed) => { if (!disposed) setState(allowed ? "allowed" : "denied"); })
      .catch(() => { if (!disposed) setState("error"); });
    return () => { disposed = true; };
  }, [isAuthenticated, user?.id, attempt]);
  return { state: isAuthenticated ? state : "denied", retry: () => setAttempt((value) => value + 1) };
}
