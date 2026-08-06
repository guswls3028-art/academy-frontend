import type { ChangeEvent, Dispatch, DragEvent, SetStateAction } from "react";
import { AlertTriangle, ChevronRight, FileArchive, FileText, Layers3, Presentation, RefreshCw, ShieldCheck, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { Badge, Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import type { ProblemReviewMetadata, ProblemReviewReport } from "../api/problemReview.api";
import styles from "./ProblemReviewPage.module.css";
import { problemReviewFileSize, problemReviewReportLabel } from "./problemReviewFormatters";

const SOURCE_ACCEPT = ".pdf,.hwp,.hwpx,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp,.bmp";

export function ProblemReviewStatusBadge({ report }: { report: ProblemReviewReport }) {
  if (report.status === "draft" && report.review_readiness?.is_finalized) return <Badge tone="success">최종 검수 완료</Badge>;
  if (report.status === "draft") return <Badge tone="warning">미검수 {report.review_readiness?.unresolved_questions ?? "-"}</Badge>;
  if (report.status === "failed") return <Badge tone="danger">분석 실패</Badge>;
  return <Badge tone="info">분석 중</Badge>;
}

type ProblemReviewStartViewProps = {
  pageError: string;
  sourceFiles: File[];
  onRemoveSourceFile: (index: number) => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  metadata: Partial<ProblemReviewMetadata>;
  setMetadata: Dispatch<SetStateAction<Partial<ProblemReviewMetadata>>>;
  aiConfirmed: boolean;
  setAiConfirmed: Dispatch<SetStateAction<boolean>>;
  starting: boolean;
  onStart: () => void;
  loadingRecent: boolean;
  recentReports: ProblemReviewReport[];
  onOpenReport: (report: ProblemReviewReport) => void;
};

export function ProblemReviewStartView({
  pageError,
  sourceFiles,
  onRemoveSourceFile,
  onDrop,
  onFileInput,
  metadata,
  setMetadata,
  aiConfirmed,
  setAiConfirmed,
  starting,
  onStart,
  loadingRecent,
  recentReports,
  onOpenReport,
}: ProblemReviewStartViewProps) {
  return (
    <section className={styles.page} aria-label="문제 리뷰 리포트 만들기">
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>EXAM SPECTRUM WORKSPACE</div>
          <h1>시험의 증거를 잇고,<br /><span>다음 행동까지 설명합니다.</span></h1>
          <p>내 문제 검수와 학교 시험 분석을 목적에 맞게 나눠 시작하세요. 전 문항의 근거·함정·복구 순서를 검수한 뒤 PDF와 PPTX로 바로 받습니다.</p>
          <div className={styles.heroProof}>
            <span><ShieldCheck size={17} />선생님별 비공개</span>
            <span><FileText size={17} />PDF</span>
            <span><Presentation size={17} />PPTX</span>
          </div>
        </div>
        <div className={styles.heroSteps}>
          {["시험지 등록", "AI 검수 초안", "수정 후 다운로드"].map((label, index) => (
            <div key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong>{index < 2 && <ChevronRight size={17} />}</div>
          ))}
        </div>
      </div>

      {pageError && <div className={styles.errorBanner} role="alert"><AlertTriangle size={18} />{pageError}</div>}

      <div className={styles.startGrid}>
        <div className={styles.uploadPanel}>
          <div className={styles.panelHeading}>
            <div><span>01 · SOURCE</span><h2>리뷰할 시험지를 등록하세요</h2></div>
            <Badge tone="neutral">최대 6개</Badge>
          </div>
          <label className={styles.dropZone} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <input type="file" accept={SOURCE_ACCEPT} multiple onChange={onFileInput} />
            <div className={styles.uploadIcon}><UploadCloud size={28} /></div>
            <strong>파일을 놓거나 눌러서 선택</strong>
            <span>PDF · HWP/HWPX · DOCX · 이미지 · ZIP · 파일당 120MB / 전체 512MB</span>
          </label>
          {sourceFiles.length > 0 && (
            <div className={styles.fileList}>
              {sourceFiles.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}`}>
                  <FileArchive size={17} /><span><strong>{file.name}</strong><small>{problemReviewFileSize(file.size)}</small></span>
                  <button type="button" onClick={() => onRemoveSourceFile(index)} aria-label={`${file.name} 제거`}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.metadataFields}>
            <fieldset className={styles.purposeSelector}>
              <legend>이번 리포트의 목적</legend>
              <label data-selected={metadata.report_purpose === "teacher_review"}>
                <input type="radio" name="report-purpose" value="teacher_review" checked={metadata.report_purpose === "teacher_review"} onChange={() => setMetadata((value) => ({ ...value, report_purpose: "teacher_review" }))} />
                <span><strong>내 문제 검수</strong><small>직접 만든 문제의 타당성·표현·변별 구조를 봅니다.</small></span>
              </label>
              <label data-selected={metadata.report_purpose === "exam_analysis"}>
                <input type="radio" name="report-purpose" value="exam_analysis" checked={metadata.report_purpose === "exam_analysis"} onChange={() => setMetadata((value) => ({ ...value, report_purpose: "exam_analysis" }))} />
                <span><strong>학교 시험 분석·홍보</strong><small>학생·학부모 설명과 홈페이지 게시용 근거를 정리합니다.</small></span>
              </label>
            </fieldset>
            <label className={styles.fullField}>리포트 제목<input placeholder="예: 1학기 중간고사 통합과학 문제 리뷰" value={metadata.title ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, title: event.target.value }))} /></label>
            <label>학교<input placeholder="학교명" value={metadata.school ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, school: event.target.value }))} /></label>
            <label>과목<input placeholder="통합과학" value={metadata.subject ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, subject: event.target.value }))} /></label>
            <label>학년<input placeholder="1학년" value={metadata.grade ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, grade: event.target.value }))} /></label>
            <label>시험명<input placeholder="1학기 중간고사" value={metadata.exam_name ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, exam_name: event.target.value }))} /></label>
          </div>

          <label className={styles.aiConsent}>
            <input type="checkbox" checked={aiConfirmed} onChange={(event) => setAiConfirmed(event.target.checked)} />
            <span><strong>외부 AI 처리 안내를 확인했습니다.</strong><small>시험지 판독과 분석을 위해 설정된 AI 제공자로 자료가 전송됩니다. 개인정보는 올리기 전에 가려 주세요.</small></span>
          </label>
          <Button className={styles.startButton} intent="primary" size="lg" loading={starting} rightIcon={<Sparkles size={ICON_FOR_BUTTON.lg} />} onClick={onStart}>
            문제 리뷰 초안 만들기
          </Button>
        </div>

        <aside className={styles.recentPanel}>
          <div className={styles.panelHeading}>
            <div><span>RECENT</span><h2>최근 리포트</h2></div>
            <Layers3 size={20} />
          </div>
          {loadingRecent ? (
            <div className={styles.recentEmpty}><RefreshCw className={styles.spin} size={22} />불러오는 중</div>
          ) : recentReports.length ? (
            <div className={styles.recentList}>
              {recentReports.map((report) => (
                <button type="button" key={report.id} onClick={() => onOpenReport(report)}>
                  <span className={styles.reportIcon}><FileText size={18} /></span>
                  <span className={styles.reportInfo}>
                    <strong>{problemReviewReportLabel(report)}</strong>
                    <small>{report.source_name || "원본 파일"}</small>
                    <small>v{report.version} · {new Date(report.updated_at).toLocaleString("ko-KR")}</small>
                  </span>
                  <ProblemReviewStatusBadge report={report} />
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.recentEmpty}><FileText size={24} /><strong>아직 만든 리포트가 없습니다.</strong><span>첫 시험지를 등록하면 이곳에서 이어서 편집할 수 있습니다.</span></div>
          )}
          <div className={styles.reportPromise}>
            <span><ShieldCheck size={18} /></span>
            <div><strong>원문은 근거로만 보존합니다.</strong><p>AI 분석은 정답이나 배점을 임의로 확정하지 않으며, 선생님이 저장한 검수본만 다운로드에 사용됩니다.</p></div>
          </div>
        </aside>
      </div>
    </section>
  );
}
