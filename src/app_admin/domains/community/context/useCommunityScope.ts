import { useContext } from "react";
import { CommunityScopeContext } from "./communityScopeCore";

export function useCommunityScope() {
  const ctx = useContext(CommunityScopeContext);
  if (!ctx) throw new Error("useCommunityScope must be used within CommunityScopeProvider");
  return ctx;
}
