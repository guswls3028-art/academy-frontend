import { createContext, useContext } from "react";
import { getSiteType, SiteType } from "@/shared/utils/site";

const SiteContext = createContext<SiteType>("hakwonplus");

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const site = getSiteType();
  return (
    <SiteContext.Provider value={site}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}
