import { useEffect, useMemo, type ReactNode } from "react";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { createSession, PptSessionContext } from "./usePptSession";

export default function PptSessionProvider({ pathname, tenant, userId, children }: {
  pathname: string; tenant: string | null; userId: string | null; children: ReactNode;
}) {
  const onPage = pathname.replace(/\/+$/, "") === "/workspace/tools/ppt";
  const ownerTenant = onPage && userId ? tenant : null;
  const generation = ownerTenant ? readAuthTokenEnvelopeSafely()?.generation ?? null : null;
  // Keep the shell mounted while changing the draft owner on route/account changes.
  const session = useMemo(() => createSession(ownerTenant, generation, userId), [ownerTenant, generation, userId]);
  useEffect(() => {
    session.activate();
    return () => session.dispose();
  }, [session]);
  return <PptSessionContext.Provider value={session}>{children}</PptSessionContext.Provider>;
}

