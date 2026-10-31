import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, ScanLine } from "lucide-react";
import type QrScanner from "qr-scanner";
import { useAuthContext } from "@/auth/context/AuthContext";
import { ICON } from "@/shared/ui/ds";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  parseQrUrl, resolveAttendanceQr, recordAttendanceQr,
  type QrAction, type QrChoice, type QrResolution, type QrReceipt,
} from "@/shared/api/contracts/attendanceQr";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import styles from "./QrScanPage.module.css";

function timeLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value)) : "기존 출결 기록";
}

export default function QrScanPage() {
  const { user } = useAuthContext();
  const location = useLocation();
  const queryClient = useQueryClient();
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const initialLink = useRef(false);
  const [camera, setCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [resolution, setResolution] = useState<QrResolution | null>(null);
  const [receipt, setReceipt] = useState<QrReceipt | null>(null);
  const [savedLabel, setSavedLabel] = useState("");
  const [paste, setPaste] = useState("");
  const isStudent = user?.tenantRole === "student";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; scanner.current?.destroy(); };
  }, []);

  const save = useCallback(async (qrToken: string, choice: QrChoice, action: QrAction) => {
    setPending(action === "check_out" ? "하원을 저장하고 있습니다…" : "출석을 저장하고 있습니다…");
    const result = await recordAttendanceQr(qrToken, choice.id, action);
    if (!mounted.current) return;
    setReceipt(result);
    setSavedLabel(choice.label);
    // All consuming student screens refetch persisted state, including calendar and clinic.
    await queryClient.invalidateQueries({ predicate: (query) =>
      String(query.queryKey[0]).startsWith("student"),
    });
  }, [queryClient]);

  const decode = useCallback(async (raw: string) => {
    if (busyRef.current || !isStudent) return;
    busyRef.current = true;
    scanner.current?.stop();
    setCamera(false);
    setError(""); setReceipt(null); setResolution(null); setToken("");
    setPending("오늘의 수업·예약을 확인하고 있습니다…");
    try {
      const qrToken = parseQrUrl(raw);
      setToken(qrToken);
      const result = await resolveAttendanceQr(qrToken);
      if (!mounted.current) return;
      setResolution(result);
      if (result.point.kind === "class" && result.choices.length === 1 && result.choices[0].can_check_in) {
        await save(qrToken, result.choices[0], "check_in");
      }
    } catch (err) {
      if (mounted.current) setError(extractApiError(err, err instanceof Error ? err.message : "QR 확인에 실패했습니다. 다시 시도해 주세요."));
    } finally {
      busyRef.current = false;
      if (mounted.current) setPending("");
    }
  }, [isStudent, save]);

  useEffect(() => {
    if (!isStudent || !location.hash || initialLink.current) return;
    initialLink.current = true;
    void decode(window.location.href);
  }, [decode, isStudent, location.hash]);

  useEffect(() => {
    if (!camera || !video.current || !isStudent) return;
    let disposed = false;
    let instance: QrScanner | null = null;
    setCameraReady(false);
    const start = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("이 브라우저에서는 실시간 카메라를 사용할 수 없습니다. 아래 QR 사진 촬영을 이용해 주세요.");
        }
        const { default: Scanner } = await import("qr-scanner");
        if (disposed || !video.current) return;
        instance = new Scanner(video.current, (result) => { void decode(result.data); }, {
          preferredCamera: "environment", maxScansPerSecond: 8,
          highlightScanRegion: true, returnDetailedScanResult: true,
        });
        scanner.current = instance;
        await instance.start();
        if (disposed) { instance.destroy(); return; }
        setCameraReady(true);
      } catch (err) {
        if (!disposed) {
          setCamera(false);
          setError(err instanceof Error && err.message.includes("이 브라우저") ? err.message
            : "카메라를 열지 못했습니다. 브라우저 설정에서 카메라 권한을 허용하고 다시 시도하거나 QR 사진 촬영을 이용해 주세요.");
        }
      }
    };
    void start();
    const onHidden = () => { if (document.hidden) setCamera(false); };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      disposed = true; instance?.destroy(); scanner.current = null;
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [camera, decode, isStudent]);

  const submit = async (choice: QrChoice, action: QrAction) => {
    if (busyRef.current) return;
    busyRef.current = true; setError("");
    try { await save(token, choice, action); }
    catch (err) { if (mounted.current) setError(extractApiError(err, "저장을 확인하지 못했습니다. 같은 버튼을 다시 눌러 확인해 주세요. 중복 기록되지 않습니다.")); }
    finally { busyRef.current = false; if (mounted.current) setPending(""); }
  };

  const readPhoto = async (file?: File) => {
    if (!file || busyRef.current) return;
    setCamera(false); setError("");
    if (file.size > 20 * 1024 * 1024) { setError("20MB 이하의 QR 사진을 선택해 주세요."); return; }
    busyRef.current = true; setPending("QR 사진을 읽고 있습니다…");
    let raw: string | null = null;
    try {
      const { default: Scanner } = await import("qr-scanner");
      raw = (await Scanner.scanImage(file, { returnDetailedScanResult: true })).data;
    } catch { if (mounted.current) setError("사진에서 QR을 찾지 못했습니다. QR 전체가 밝고 선명하게 보이도록 다시 촬영해 주세요."); }
    finally { busyRef.current = false; if (mounted.current) setPending(""); }
    if (raw && mounted.current) await decode(raw);
  };

  if (!isStudent) return <StudentPageShell title="QR 출석">
    <p>QR 출석은 학생 본인 계정으로만 할 수 있습니다.</p>
    <Link to="/student/attendance">출결 현황 보기</Link>
  </StudentPageShell>;

  return <StudentPageShell title="QR 출석" description="교실에 붙은 QR을 촬영해 주세요. 수업 출석과 클리닉 등원·하원을 기록합니다.">
    <div className={styles.page}>
      {receipt ? <section className={styles.receipt} role="status" aria-live="polite">
        <CheckCircle2 size={ICON.xl} aria-hidden="true" />
        <h2>{receipt.detail}</h2><p>{savedLabel}</p><strong>{timeLabel(receipt.recorded_at)}</strong>
        <p>저장된 기록은 새로고침해도 유지됩니다.</p>
        <Link to={receipt.kind === "clinic" ? "/student/clinic" : "/student/attendance"}>내 {receipt.kind === "clinic" ? "클리닉" : "출결"} 기록 보기</Link>
        <button type="button" className={styles.secondary} onClick={() => { setReceipt(null); setResolution(null); setError(""); setCamera(true); }}>다른 QR 스캔</button>
      </section> : <>
        <section className={styles.camera} aria-label="QR 카메라">
          <video ref={video} playsInline muted aria-label="카메라 미리보기" className={camera ? styles.video : styles.hiddenVideo} />
          {!camera && <div className={styles.placeholder}><ScanLine size={ICON.xl} aria-hidden="true" /><p>QR 전체가 화면 안에 들어오도록 맞춰 주세요.</p></div>}
          {camera && !cameraReady && <p className={styles.cameraStatus} role="status">카메라를 여는 중…</p>}
        </section>
        <div className={styles.controls}>
          <button type="button" className={styles.primary} disabled={Boolean(pending)} onClick={() => { setError(""); setCamera(!camera); }}>
            <Camera size={ICON.md} aria-hidden="true" />{camera ? "카메라 끄기" : "카메라로 QR 스캔"}
          </button>
          <label className={styles.photo}>QR 사진 촬영·선택<input type="file" accept="image/*" capture="environment" disabled={Boolean(pending)} onChange={(event) => { void readPhoto(event.target.files?.[0]); event.target.value = ""; }} /></label>
        </div>
        {pending && <p role="status" aria-live="polite">{pending}</p>}
        {resolution && !pending && <section className={styles.choices}>
          <h2>{resolution.point.label}</h2>
          {resolution.choices.length === 0 ? <p>지금 기록할 수 있는 수업·확정 예약이 없습니다. 수업은 오늘 등록된 차시, 클리닉은 예약 시작 1시간 전부터 종료 3시간 후까지 이용할 수 있습니다.</p>
            : <p>{resolution.point.kind === "clinic" ? "등원과 하원을 구분해 눌러 주세요. 하원은 학습 완료와 별도로 기록됩니다." : "출석할 수업을 선택해 주세요."}</p>}
          {resolution.choices.map((choice) => <article key={choice.id} className={styles.choice}>
            <h3>{choice.label}</h3><p>{choice.date}{choice.start_time ? ` · ${choice.start_time.slice(0, 5)}` : ""}</p>
            {choice.checked_in_at && <p>등원 {timeLabel(choice.checked_in_at)}</p>}
            {choice.checked_out_at && <p>하원 {timeLabel(choice.checked_out_at)}</p>}
            <div className={styles.controls}>
              {choice.can_check_in && <button type="button" className={styles.primary} onClick={() => { void submit(choice, "check_in"); }}>{resolution.point.kind === "class" ? "출석하기" : "등원하기"}</button>}
              {choice.can_check_out && <button type="button" className={styles.primary} onClick={() => { void submit(choice, "check_out"); }}>{choice.checked_out_at ? "하원 기록 확인" : "하원하기"}</button>}
            </div>
            {!choice.can_check_in && !choice.can_check_out && <p>선생님이 입력한 출결 상태는 QR로 변경할 수 없습니다. 선생님에게 확인해 주세요.</p>}
          </article>)}
        </section>}
        <details className={styles.help}><summary>카메라 사용이 어려운가요?</summary><p>카메라 권한을 허용하거나 QR 사진 촬영·선택을 이용해 주세요. 휴대폰 기본 카메라로 인식한 출결 링크를 붙여 넣어도 됩니다.</p>
          <form onSubmit={(event) => { event.preventDefault(); void decode(paste); }}><label>출결 QR 링크<input type="url" value={paste} onChange={(event) => setPaste(event.target.value)} required placeholder="https://…/student/attendance/scan#qr=…" /></label><button className={styles.secondary} disabled={Boolean(pending)}>링크 확인</button></form>
        </details>
      </>}
      {error && <div role="alert" className={styles.error}><p>{error}</p>{token && <button type="button" className={styles.secondary} disabled={Boolean(pending)} onClick={() => { void decode(`${window.location.origin}/student/attendance/scan#qr=${token}`); }}>같은 QR 다시 확인</button>}</div>}
    </div>
  </StudentPageShell>;
}
