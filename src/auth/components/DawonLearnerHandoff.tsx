import { useCallback, useEffect, useRef, useState } from "react";
import { enterDawonDemo } from "@/auth/api/auth.api";
import useAuth from "@/auth/hooks/useAuth";
import { learnerHandoffKey, type LearnerRole } from "@/shared/product/dawon/learnerHandoff";
import { removeSessionItem, setSessionItem } from "@/shared/utils/safeSessionStorage";
import styles from "@/auth/pages/LoginPage.module.css";

export default function DawonLearnerHandoff({ role }: { role: LearnerRole }) {
  const { refreshMe, clearAuth } = useAuth();
  const started = useRef(false);
  const pending = useRef(false);
  const [failed, setFailed] = useState(false);

  const enter = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setFailed(false);
    try {
      await enterDawonDemo(role);
      const identity = await refreshMe();
      if (identity?.tenantRole !== (role === "guardian" ? "parent" : "student")) {
        clearAuth();
        throw new Error("학습 역할을 확인하지 못했습니다.");
      }
      setSessionItem("dawon-room-role", role);
      removeSessionItem("dawon-workspace-role");
      removeSessionItem(learnerHandoffKey);
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
    }
  }, [clearAuth, refreshMe, role]);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void enter();
  }, [enter]);

  const family = role === "guardian";
  return <main className={styles.counselEntry}>
    <a className={styles.counselBrand} href={family ? "/guardian" : "/student"} aria-label="다원수학 홈">
      <img src="/dawon-brand.svg" width="32" height="32" alt="" />다원수학
    </a>
    <section aria-labelledby="dawon-learner-handoff">
      <h1 id="dawon-learner-handoff">{family ? "학부모 학습" : "학생 학습"}</h1>
      {failed ? <>
        <p role="alert">학습 화면에 연결하지 못했습니다.</p>
        <button type="button" className={styles.btnPrimary} onClick={() => void enter()}>다시 시도</button>
      </> : <p role="status">학습 화면을 여는 중입니다.</p>}
    </section>
  </main>;
}
