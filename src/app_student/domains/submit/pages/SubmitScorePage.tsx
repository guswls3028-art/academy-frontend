/**
 * 성적표 제출 — 시험 정보 + 원본 증빙을 함께 제출하고 교직원 확인 상태를 조회한다.
 */
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import {
  fetchMyInventory,
  getMyFileUrl,
  uploadMyFile,
  type InventoryFile,
} from "@student/domains/inventory/api/inventory.api";
import { IconDownload, IconFileText, IconImage } from "@student/shared/ui/icons/Icons";
import { studentToast } from "@student/shared/ui/feedback/studentToast";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import type { StudentScoreSource } from "@/shared/api/contracts/storage";
import { formatCompactFileSize as formatBytes } from "@/shared/utils/fileSize";
import styles from "./SubmitScorePage.module.css";

const ACCEPT = "image/png,image/jpeg,.pdf";
const MAX_SIZE_MB = 20;
const CURRENT_YEAR = new Date().getFullYear();
const SUBJECTS = ["국어", "수학", "영어", "과학", "사회", "한국사", "기타"];

const SOURCE_OPTIONS: Array<{
  value: StudentScoreSource;
  title: string;
  description: string;
}> = [
  { value: "school_exam", title: "학교 내신", description: "1·2학기 지필평가" },
  { value: "national_mock", title: "전국연합", description: "교육청 학력평가" },
  { value: "kice_mock", title: "평가원 모의", description: "6·9월 모의평가" },
];

const STATUS_COPY = {
  pending: { label: "확인 대기", description: "선생님이 성적표를 확인하고 있어요." },
  verified: { label: "반영 완료", description: "확인된 성적이 누적 통계에 반영됐어요." },
  rejected: { label: "반영 보류", description: "제출 내용을 확인해 주세요." },
} as const;

function FileIcon({ file }: { file: InventoryFile }) {
  const ct = file.contentType || "";
  if (ct.startsWith("image/")) return <IconImage className={styles.fileIcon} />;
  return <IconFileText className={styles.fileIcon} />;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

export default function SubmitScorePage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [source, setSource] = useState<StudentScoreSource>("school_exam");
  const [academicYear, setAcademicYear] = useState(CURRENT_YEAR);
  const [semester, setSemester] = useState<1 | 2>(1);
  const [examRound, setExamRound] = useState<"first" | "second">("first");
  const [examMonth, setExamMonth] = useState(6);
  const [examDate, setExamDate] = useState("");
  const [subject, setSubject] = useState("수학");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [standardScore, setStandardScore] = useState("");
  const [percentile, setPercentile] = useState("");
  const [gradeRank, setGradeRank] = useState("");
  const [gradeScale, setGradeScale] = useState<"" | "five" | "nine">("");
  const [achievementLevel, setAchievementLevel] = useState("");
  const [subjectAverage, setSubjectAverage] = useState("");
  const [standardDeviation, setStandardDeviation] = useState("");
  const [cohortSize, setCohortSize] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: studentQueryKeys.me,
    queryFn: fetchMyProfile,
  });

  const ps = profile?.ps_number || "";
  const {
    data: inventory,
    isLoading: inventoryLoading,
    isError: inventoryError,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: studentQueryKeys.inventory(ps),
    queryFn: () => fetchMyInventory(ps),
    enabled: !!ps,
  });

  const recentScores = useMemo(
    () => (inventory?.files ?? [])
      .filter((file) => file.scoreSubmission || file.description?.includes("성적표"))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 5),
    [inventory?.files],
  );

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!ps) throw new Error("프로필을 불러오는 중입니다.");
      if (!selectedFile) throw new Error("성적표 원본을 선택해 주세요.");
      if (!subject.trim()) throw new Error("과목을 입력해 주세요.");
      const scoreNumber = Number(score);
      const maxScoreNumber = Number(maxScore);
      if (!Number.isFinite(scoreNumber) || scoreNumber < 0) throw new Error("받은 점수를 확인해 주세요.");
      if (!Number.isFinite(maxScoreNumber) || maxScoreNumber <= 0) throw new Error("만점을 확인해 주세요.");
      if (scoreNumber > maxScoreNumber) throw new Error("받은 점수는 만점보다 클 수 없습니다.");
      if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      }
      const sourceTitle = SOURCE_OPTIONS.find((option) => option.value === source)?.title ?? "성적";
      return uploadMyFile(ps, selectedFile, {
        displayName: selectedFile.name,
        description: `성적표 제출 · ${sourceTitle} · ${subject.trim()}`,
        icon: "file-text",
        scoreSubmission: {
          source,
          academicYear,
          subject: subject.trim(),
          score: scoreNumber,
          maxScore: maxScoreNumber,
          semester: source === "school_exam" ? semester : undefined,
          examRound: source === "school_exam" ? examRound : undefined,
          examMonth: source !== "school_exam" ? examMonth : undefined,
          examDate: examDate || undefined,
          standardScore: source !== "school_exam" ? optionalNumber(standardScore) : undefined,
          percentile: source !== "school_exam" ? optionalNumber(percentile) : undefined,
          gradeRank: optionalNumber(gradeRank),
          gradeScale: source === "school_exam"
            ? gradeScale || undefined
            : gradeRank ? "nine" : undefined,
          achievementLevel: source === "school_exam" && achievementLevel
            ? achievementLevel as "A" | "B" | "C" | "D" | "E"
            : undefined,
          subjectAverage: source === "school_exam" ? optionalNumber(subjectAverage) : undefined,
          standardDeviation: source === "school_exam" ? optionalNumber(standardDeviation) : undefined,
          cohortSize: source === "school_exam" ? optionalNumber(cohortSize) : undefined,
        },
      });
    },
    onSuccess: () => {
      clearSelectedFile();
      setScore("");
      void qc.invalidateQueries({ queryKey: studentQueryKeys.inventory(ps) });
      studentToast.success("성적표를 선생님께 보냈습니다.");
    },
    onError: (e: Error) => setError(e.message || "제출에 실패했습니다."),
  });

  const handleDownload = async (file: InventoryFile) => {
    try {
      const { url } = await getMyFileUrl(file.r2Key);
      if (url) window.open(url, "_blank", "noopener");
    } catch {
      studentToast.error("성적표를 열 수 없습니다.");
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) { setSelectedFile(null); return; }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const canSubmit = !profileLoading && !!ps && !!selectedFile && !!subject.trim() && score !== "" && maxScore !== "";
  const isMock = source !== "school_exam";

  return (
    <StudentPageShell
      title="성적표 제출"
      description="시험 정보와 성적표 원본을 보내면, 선생님 확인 후 내 성적 추이에 반영됩니다."
      descriptionMode="help"
      onBack={() => window.history.back()}
    >
      <div className={`stu-section stu-section--nested ${styles.sectionStack}`}>
        <div className={styles.processStrip} aria-label="성적 반영 절차">
          <strong>정보 입력</strong><span aria-hidden>→</span><strong>성적표 제출</strong><span aria-hidden>→</span><strong>선생님 확인</strong><span aria-hidden>→</span><strong>통계 반영</strong>
        </div>

        {profileLoading && <div className="stu-muted">프로필 불러오는 중…</div>}
        {!profileLoading && profile?.isParentReadOnly && (
          <div role="alert" className={`${styles.alert} ${styles.alertMuted}`}>
            학부모 계정은 성적표를 제출할 수 없습니다. 자녀(학생) 계정으로 로그인해 주세요.
          </div>
        )}
        {!profileLoading && profile && !ps && !profile.isParentReadOnly && (
          <div role="alert" className={`${styles.alert} ${styles.alertPlain}`}>
            제출 기능을 사용할 수 없습니다. 관리자에게 문의해 주세요.
          </div>
        )}
        {(uploadMut.isError || error) && (
          <div role="alert" className={`${styles.alert} ${styles.alertDanger}`}>
            {error || (uploadMut.error instanceof Error ? uploadMut.error.message : "제출에 실패했습니다.")}
          </div>
        )}
        {uploadMut.isSuccess && (
          <div className={styles.successBanner}>
            <strong>성적표를 보냈습니다.</strong>
            <span>선생님이 원본을 확인하면 누적 성적에 반영됩니다.</span>
          </div>
        )}

        {!profile?.isParentReadOnly && (
          <>
            <section className={styles.formSection} aria-labelledby="score-source-title">
              <header className={styles.formHeader}>
                <span>01</span>
                <div><h2 id="score-source-title">어떤 시험인가요?</h2><p>시험 종류에 맞는 성적 기준을 적용합니다.</p></div>
              </header>
              <div className={styles.sourceGrid} aria-label="시험 종류">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={source === option.value}
                    data-active={source === option.value ? "true" : "false"}
                    onClick={() => {
                      if (option.value !== source) {
                        setGradeRank("");
                        if (option.value !== "school_exam") setGradeScale("");
                      }
                      setSource(option.value);
                      if (option.value === "kice_mock" && examMonth !== 6 && examMonth !== 9) {
                        setExamMonth(6);
                      }
                    }}
                  >
                    <strong>{option.title}</strong><span>{option.description}</span>
                  </button>
                ))}
              </div>
              <div className={styles.fieldGrid}>
                <label><span>학년도</span><select className="stu-input" value={academicYear} onChange={(event) => setAcademicYear(Number(event.target.value))}>{[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((year) => <option key={year} value={year}>{year}년</option>)}</select></label>
                {source === "school_exam" ? (
                  <>
                    <label><span>학기</span><select className="stu-input" value={semester} onChange={(event) => setSemester(Number(event.target.value) as 1 | 2)}><option value={1}>1학기</option><option value={2}>2학기</option></select></label>
                    <label><span>시험</span><select data-testid="score-exam-round" className="stu-input" value={examRound} onChange={(event) => setExamRound(event.target.value as "first" | "second")}><option value="first">1차 지필평가 (중간고사)</option><option value="second">2차 지필평가 (기말고사)</option></select></label>
                  </>
                ) : (
                  <label><span>시험 월</span><select data-testid="score-exam-month" className="stu-input" value={examMonth} onChange={(event) => setExamMonth(Number(event.target.value))}>{(source === "kice_mock" ? [6, 9] : Array.from({ length: 12 }, (_, index) => index + 1)).map((month) => <option key={month} value={month}>{month}월</option>)}</select></label>
                )}
                <label><span>시험일 <em>선택</em></span><input className="stu-input" type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label>
              </div>
            </section>

            <section className={styles.formSection} aria-labelledby="score-value-title">
              <header className={styles.formHeader}>
                <span>02</span>
                <div><h2 id="score-value-title">성적을 알려주세요</h2><p>원본과 비교할 수 있도록 성적표에 적힌 값을 입력합니다.</p></div>
              </header>
              <div className={styles.fieldGrid}>
                <label><span>과목</span><input className="stu-input" list="score-subjects" value={subject} maxLength={50} onChange={(event) => setSubject(event.target.value)} placeholder="예: 수학" /><datalist id="score-subjects">{SUBJECTS.map((item) => <option key={item} value={item} />)}</datalist></label>
                <label><span>받은 점수</span><input className="stu-input" type="number" min="0" step="0.01" value={score} onChange={(event) => setScore(event.target.value)} inputMode="decimal" placeholder="예: 88" /></label>
                <label><span>만점</span><input className="stu-input" type="number" min="0.01" step="0.01" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} inputMode="decimal" /></label>
                {source === "school_exam" && <label><span>등급 체계 <em>등급 입력 시 필수</em></span><select data-testid="score-grade-scale" className="stu-input" value={gradeScale} onChange={(event) => { setGradeScale(event.target.value as "" | "five" | "nine"); setGradeRank(""); }}><option value="">입력 안 함</option><option value="five">5등급제</option><option value="nine">9등급제</option></select></label>}
                <label><span>등급 <em>선택</em></span><select data-testid="score-grade-rank" className="stu-input" value={gradeRank} disabled={source === "school_exam" && !gradeScale} onChange={(event) => setGradeRank(event.target.value)}><option value="">{source === "school_exam" && !gradeScale ? "등급 체계를 먼저 선택" : "입력 안 함"}</option>{Array.from({ length: source === "school_exam" && gradeScale === "five" ? 5 : 9 }, (_, index) => index + 1).map((rank) => <option key={rank} value={rank}>{rank}등급</option>)}</select></label>
                {source === "school_exam" && <label><span>성취도 <em>선택</em></span><select className="stu-input" value={achievementLevel} onChange={(event) => setAchievementLevel(event.target.value)}><option value="">입력 안 함</option>{["A", "B", "C", "D", "E"].map((level) => <option key={level} value={level}>{level}</option>)}</select></label>}
                {source === "school_exam" && <label><span>과목 평균 <em>선택</em></span><input className="stu-input" type="number" min="0" step="0.01" value={subjectAverage} onChange={(event) => setSubjectAverage(event.target.value)} inputMode="decimal" /></label>}
                {source === "school_exam" && <label><span>표준편차 <em>선택</em></span><input className="stu-input" type="number" min="0" step="0.01" value={standardDeviation} onChange={(event) => setStandardDeviation(event.target.value)} inputMode="decimal" /></label>}
                {source === "school_exam" && <label><span>수강자 수 <em>선택</em></span><input className="stu-input" type="number" min="1" step="1" value={cohortSize} onChange={(event) => setCohortSize(event.target.value)} inputMode="numeric" /></label>}
                {isMock && <label><span>표준점수 <em>선택</em></span><input className="stu-input" type="number" min="0" step="0.01" value={standardScore} onChange={(event) => setStandardScore(event.target.value)} inputMode="decimal" /></label>}
                {isMock && <label><span>백분위 <em>선택</em></span><input className="stu-input" type="number" min="0" max="100" step="0.01" value={percentile} onChange={(event) => setPercentile(event.target.value)} inputMode="decimal" /></label>}
              </div>
            </section>

            <section className={styles.formSection} aria-labelledby="score-file-title">
              <header className={styles.formHeader}>
                <span>03</span>
                <div><h2 id="score-file-title">성적표 원본을 올려주세요</h2><p>이름과 점수가 보이는 이미지 또는 PDF를 첨부합니다.</p></div>
              </header>
              <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={onFileChange} className={styles.hiddenInput} />
              <button type="button" disabled={profileLoading} onClick={() => fileInputRef.current?.click()} className={`stu-btn stu-btn--secondary ${styles.chooseButton}`}>
                {selectedFile ? "다른 파일 선택" : `성적표 선택 (최대 ${MAX_SIZE_MB}MB)`}
              </button>
              {selectedFile && (
                <div className={styles.selectedFile}>
                  <span className={styles.selectedFileName}>{selectedFile.name}<small>{formatBytes(selectedFile.size)}</small></span>
                  <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={clearSelectedFile}>파일 빼기</button>
                </div>
              )}
            </section>

            <button type="button" disabled={!canSubmit || uploadMut.isPending} onClick={() => uploadMut.mutate()} className={`stu-btn stu-btn--primary ${styles.submitButton}`}>
              {uploadMut.isPending ? "성적표 보내는 중…" : "성적표 보내기"}
            </button>
          </>
        )}

        <section className={styles.recent} aria-labelledby="recent-score-title">
          <div className={styles.recentTitle}><h2 id="recent-score-title">최근 제출</h2><span>확인된 성적만 통계에 반영됩니다.</span></div>
          {inventoryLoading ? (
            <div className={styles.recentEmpty}>최근 제출을 불러오는 중…</div>
          ) : inventoryError ? (
            <div className={styles.recentEmpty}>최근 제출을 불러오지 못했습니다.<button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={() => { void refetchInventory(); }}>다시 시도</button></div>
          ) : recentScores.length === 0 ? (
            <div className={styles.recentEmpty}>아직 제출한 성적표가 없습니다.</div>
          ) : (
            <div className={styles.recentList}>
              {recentScores.map((file) => {
                const submission = file.scoreSubmission;
                const status = submission ? STATUS_COPY[submission.status] : null;
                return (
                  <article key={file.id} className={styles.recentItem}>
                    <FileIcon file={file} />
                    <span className={styles.fileName}>
                      <strong>{submission?.label || file.displayName || file.name}</strong>
                      <small>{submission ? `${submission.subject} · ${submission.score}/${submission.max_score}점` : file.displayName || file.name}</small>
                    </span>
                    {status && <span className={styles.statusBadge} data-status={submission?.status}><strong>{status.label}</strong><small>{submission?.review_note || status.description}</small></span>}
                    <span className={styles.fileMeta}>{formatDate(file.createdAt)}</span>
                    <button type="button" className={`stu-btn stu-btn--ghost stu-btn--sm ${styles.iconButton}`} onClick={() => handleDownload(file)} title="성적표 원본 보기" aria-label="성적표 원본 보기">
                      <IconDownload className={styles.downloadIcon} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </StudentPageShell>
  );
}
