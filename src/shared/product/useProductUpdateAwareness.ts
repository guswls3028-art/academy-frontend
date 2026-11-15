import { useCallback, useEffect, useState } from "react";
import {
  getTenantUserLocalItem,
  setTenantUserLocalItem,
} from "@/shared/utils/safeLocalStorage";
import { LATEST_PRODUCT_UPDATE } from "./productUpdates";

const LAST_READ_KEY = "academy:product-updates:last-read";
const READ_EVENT = "academy:product-update-read";

function readLastSeenUpdate(userId: string | number | null | undefined): string {
  return getTenantUserLocalItem(LAST_READ_KEY, userId) ?? "";
}

export function useProductUpdateAwareness(userId?: string | number | null) {
  const [isUnread, setIsUnread] = useState(() => (
    typeof window !== "undefined" && readLastSeenUpdate(userId) !== LATEST_PRODUCT_UPDATE.id
  ));

  useEffect(() => {
    const sync = () => setIsUnread(readLastSeenUpdate(userId) !== LATEST_PRODUCT_UPDATE.id);
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(READ_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(READ_EVENT, sync);
    };
  }, [userId]);

  const markRead = useCallback(() => {
    setTenantUserLocalItem(LAST_READ_KEY, userId, LATEST_PRODUCT_UPDATE.id);
    setIsUnread(false);
    window.dispatchEvent(new Event(READ_EVENT));
  }, [userId]);

  return {
    isUnread,
    markRead,
  };
}
