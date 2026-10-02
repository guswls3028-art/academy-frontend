import { useEffect, useState } from "react";
import useAuth from "@/auth/hooks/useAuth";
import { resourceCapability } from "../api/publicResources";

export function useResourcePublisher() {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<"loading" | "allowed" | "denied" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    if (!isAuthenticated) { setState("denied"); return; }
    setState("loading");
    resourceCapability().then((allowed) => { if (!disposed) setState(allowed ? "allowed" : "denied"); })
      .catch(() => { if (!disposed) setState("error"); });
    return () => { disposed = true; };
  }, [isAuthenticated, user?.id, retry]);
  return { state: isAuthenticated ? state : "denied", retry: () => setRetry((value) => value + 1) };
}
