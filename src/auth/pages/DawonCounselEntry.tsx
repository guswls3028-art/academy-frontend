import { useEffect, useRef, useState } from "react";
import { getSessionItem, removeSessionItem } from "@/shared/utils/safeSessionStorage";
import styles from "./LoginPage.module.css";

export function counselEntrySearch(params: URLSearchParams): string | null {
  const panel = params.get("panel");
  if (params.get("demo") !== "guardian" || params.get("view") !== "counsel" || (panel !== "form" && panel !== "history")) return null;
  const query = new URLSearchParams({ demo: "guardian", view: "counsel", panel });
  const date = params.get("date");
  if (panel === "history" && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) query.set("date", date);
  return "?" + query.toString();
}

function hasRecentIntent(search: string) {
  try {
    const intent = JSON.parse(getSessionItem("dawon-counsel-intent") ?? "null");
    return intent?.search === search && Number.isFinite(intent.at) && Date.now() >= intent.at && Date.now() - intent.at < 120_000;
  } catch {
    return false;
  }
}

export default function DawonCounselEntry({ search, pending, error, onEnter }: {
  search: string; pending: boolean; error: string; onEnter: () => Promise<void>;
}) {
  const [fromFamilyMenu] = useState(() => hasRecentIntent(search));
  const started = useRef(false);
  useEffect(() => {
    if (!fromFamilyMenu || started.current) return;
    started.current = true;
    removeSessionItem("dawon-counsel-intent");
    void onEnter();
  }, [fromFamilyMenu, onEnter]);
  const title = new URLSearchParams(search).get("panel") === "form" ? "상담 신청" : "상담 내역";
  return (
    <main className={styles.counselEntry}>
      <a href="/guardian">학부모 홈</a>
      <section aria-labelledby="guardian-counsel-entry">
        <h1 id="guardian-counsel-entry">{title}</h1>
        {error ? <p role="alert">{error}</p> : pending || fromFamilyMenu ? <p role="status">학부모 상담을 여는 중입니다.</p> : <p>다원수학 학부모 체험 계정으로 들어갑니다.</p>}
        {!pending && (error || !fromFamilyMenu) && <button type="button" className={styles.btnPrimary} onClick={() => void onEnter()}>{error ? "다시 시도" : title + " 열기"}</button>}
      </section>
    </main>
  );
}
