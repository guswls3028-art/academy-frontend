// PATH: src/features/developer/pages/DeveloperPage.tsx
// To개발자 — 버그 제보 / 피드백 페이지

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bug, MessageSquare, ImagePlus, Send, Trash2, Paperclip, Sparkles, Wrench } from "lucide-react";
import { DomainLayout } from "@/shared/ui/layout";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  ensureBugReportBlockType,
  ensureDevFeedbackBlockType,
  createPost,
  uploadPostAttachments,
  fetchAdminPosts,
  deletePost,
  type PostEntity,
} from "@/features/community/api/community.api";
import tabStyles from "@/shared/ui/domain/StorageStyleTabs.module.css";
import styles from "./DeveloperPage.module.css";

type Tab = "bug" | "feedback" | "updates" | "bugfixes";

export default function DeveloperPage() {
  const [tab, setTab] = useState<Tab>("updates");

  return (
    <DomainLayout
      title="To개발자"
      description="업데이트 내역, 버그 수정 기록, 제보 및 피드백"
    >
      <div className={tabStyles.wrap}>
        <div className={tabStyles.tabs}>
          <button
            type="button"
            className={tabStyles.tab + (tab === "updates" ? " " + tabStyles.tabActive : "")}
            onClick={() => setTab("updates")}
          >
            <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            업데이트
          </button>
          <button
            type="button"
            className={tabStyles.tab + (tab === "bugfixes" ? " " + tabStyles.tabActive : "")}
            onClick={() => setTab("bugfixes")}
          >
            <Wrench size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            버그픽스
          </button>
          <button
            type="button"
            className={tabStyles.tab + (tab === "bug" ? " " + tabStyles.tabActive : "")}
            onClick={() => setTab("bug")}
          >
            <Bug size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            버그 제보
          </button>
          <button
            type="button"
            className={tabStyles.tab + (tab === "feedback" ? " " + tabStyles.tabActive : "")}
            onClick={() => setTab("feedback")}
          >
            <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            피드백
          </button>
        </div>

        {tab === "updates" && <UpdatesPanel />}
        {tab === "bugfixes" && <BugfixesPanel />}
        {tab === "bug" && <BugReportPanel />}
        {tab === "feedback" && <FeedbackPanel />}
      </div>
    </DomainLayout>
  );
}

// ═══════════════════ 업데이트 기록 ═══════════════════

function UpdatesPanel() {
  return (
    <div className={styles.changelog}>
      <div className={styles.changelogEntry}>
        <div className={styles.changelogDate}>
          2026-03-16 <span className={styles.changelogVersion}>V1.1.1</span>
        </div>
        <ul className={styles.changelogItems}>
          <li>클리닉 UX 전면 재설계 (오늘/일정 관리/예약/클리닉 진행)</li>
          <li>클리닉 진행: 미통과 항목 인라인 표시 + 학생 상세 오버레이</li>
          <li>학생 대시보드 개편 (다음 일정 카운트다운, 오늘 할 일)</li>
          <li>학생 클리닉 2탭 (예약/내 일정 분리)</li>
          <li>클리닉 PDF 미리보기 + 프리미엄 디자인</li>
          <li>영상 인코딩 상태 표시 + 오름차순 정렬</li>
          <li>에이전트 모니터 (/dev/agents) — 실시간 병렬 에이전트 대시보드</li>
          <li>새 배포 감지 → 새로고침 안내 배너</li>
        </ul>
      </div>
      <div className={styles.changelogEntry}>
        <div className={styles.changelogDate}>
          2026-03-15 <span className={styles.changelogVersion}>V1.1.0</span>
        </div>
        <ul className={styles.changelogItems}>
          <li>무중단 배포 인프라 전환 (Zero-Downtime Deployment)</li>
          <li>학생 ID SSOT 감사 — ps_number/username 동기화 통일</li>
          <li>삭제 학생 고스트 데이터 제거 (커뮤니티, 영상 댓글, 클리닉)</li>
          <li>학부모 초기 비밀번호 0000 통일 및 전체 초기화</li>
          <li>클리닉 예약 테넌트 격리 강화</li>
        </ul>
      </div>
      <div className={styles.changelogEntry}>
        <div className={styles.changelogDate}>
          2026-03-14 <span className={styles.changelogVersion}>V1.0.3+</span>
        </div>
        <ul className={styles.changelogItems}>
          <li>테넌트 격리 하드닝 (커뮤니티/대시보드 fallback 제거)</li>
          <li>영상 좋아요 race condition 수정</li>
          <li>StudentTopBar 쿼리 키 정규화</li>
        </ul>
      </div>
      <div className={styles.changelogEntry}>
        <div className={styles.changelogDate}>
          2026-03-13 <span className={styles.changelogVersion}>V1.0.3</span>
        </div>
        <ul className={styles.changelogItems}>
          <li>영상 처리 인프라 하드닝 (daemon/batch 이중 모드)</li>
          <li>R2 publish 병렬화 (ThreadPoolExecutor 16)</li>
          <li>영상 복구 커맨드 추가</li>
        </ul>
      </div>
      <div className={styles.changelogEntry}>
        <div className={styles.changelogDate}>
          2026-03-12 <span className={styles.changelogVersion}>V1.0.2</span>
        </div>
        <ul className={styles.changelogItems}>
          <li>구독/결제 시스템</li>
          <li>영상 소셜 기능 (좋아요, 댓글, 조회수)</li>
          <li>직원 프로필 사진</li>
          <li>동명이인 넘버링</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════ 버그픽스 기록 ═══════════════════

function BugfixesPanel() {
  return (
    <div className={styles.changelog}>
      <div className={styles.changelogEntry}>
        <div className={styles.changelogDate}>
          2026-03-16 <span className={styles.changelogVersion}>V1.1.1</span>
        </div>
        <ul className={styles.changelogItems}>
          <li data-type="fix">선생님 대상자 등록 400 에러 — enrollment_id→student 자동 resolve</li>
          <li data-type="fix">학생 클리닉 재예약 차단 — 중복 체크에서 cancelled 제외</li>
          <li data-type="fix">로그인 페이지 프로모 무한 리다이렉트 제거</li>
          <li data-type="fix">참가자 0명 클리닉 세션 오늘 탭 미표시</li>
          <li data-type="fix">시험 카드 클릭 네비게이션 오류 수정</li>
          <li data-type="fix">시험 생성 후 목록 미갱신</li>
          <li data-type="fix">출석 토글 뮤테이션 추적 누락</li>
          <li data-type="fix">일괄 승인 부분 실패 피드백 추가</li>
          <li data-type="fix">학생앱 API 에러 삼킴 수정 (빈 배열 → 에러 전파)</li>
          <li data-type="fix">점수 편집모드 기본 활성화</li>
          <li data-type="fix">드로어/오버레이 배너 오프셋</li>
          <li data-type="fix">캘린더 날짜 하루 밀림 (타임존)</li>
          <li data-type="fix">React hooks 규칙 위반 수정</li>
        </ul>
      </div>
      <div className={styles.changelogEntry}>
        <div className={styles.changelogDate}>
          2026-03-15
        </div>
        <ul className={styles.changelogItems}>
          <li data-type="fix">클리닉 예약 서버 오류 (500) — 세션 카운트 어노테이션 JOIN 충돌</li>
          <li data-type="fix">학생 삭제 시 클리닉 예약 미취소 → CANCELLED 자동 처리</li>
          <li data-type="security">클리닉 세션 FK 테넌트 미검증 → serializer + view 이중 체크</li>
          <li data-type="fix">동시 예약 시 IntegrityError → 409 응답 처리</li>
          <li data-type="fix">학부모 비밀번호 메시지-DB 불일치 (메시지: 학생 비밀번호 → 0000 통일)</li>
          <li data-type="fix">select_for_update 범위 확장 (학생+선생 모두 세션 락)</li>
        </ul>
      </div>
      <div className={styles.changelogEntry}>
        <div className={styles.changelogDate}>
          2026-03-14
        </div>
        <ul className={styles.changelogItems}>
          <li data-type="fix">커뮤니티/대시보드 테넌트 fallback 제거 (격리 위반)</li>
          <li data-type="fix">시험 등록 enrollment 테넌트 교차 검증</li>
          <li data-type="fix">학생 영상 조회 lecture tenant 교차 검증</li>
          <li data-type="fix">영상 좋아요 select_for_update race condition</li>
        </ul>
      </div>
      <div className={styles.changelogEntry}>
        <div className={styles.changelogDate}>
          2026-03-09
        </div>
        <ul className={styles.changelogItems}>
          <li data-type="fix">ExamListPage 로딩 중 빈 상태 렌더링</li>
          <li data-type="fix">ExamResultPage 디버그 필드 노출</li>
          <li data-type="fix">프로필 쿼리 키 정규화 (["student", "me"])</li>
          <li data-type="fix">QnaPage 죽은 파일 업로드 UI 제거</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════ 버그 제보 패널 ═══════════════════

function BugReportPanel() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 블록타입 ID 가져오기
  const { data: blockTypeId } = useQuery({
    queryKey: ["dev-block-type", "bug_report"],
    queryFn: ensureBugReportBlockType,
    staleTime: Infinity,
  });

  // 기존 버그 리포트 목록
  const { data: posts } = useQuery({
    queryKey: ["dev-posts", "bug_report", blockTypeId],
    queryFn: () => fetchAdminPosts({ blockTypeId: blockTypeId!, pageSize: 50 }),
    enabled: blockTypeId != null,
  });

  // 이미지 붙여넣기 핸들러
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addImage(file);
        break;
      }
    }
  }, []);

  const addImage = (file: File) => {
    setImages((prev) => [...prev, file]);
    const url = URL.createObjectURL(file);
    setPreviews((prev) => [...prev, url]);
  };

  const removeImage = (idx: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.type.startsWith("image/")) addImage(f);
    }
    e.target.value = "";
  };

  // cleanup previews on unmount
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  useEffect(() => {
    return () => previewsRef.current.forEach(URL.revokeObjectURL);
  }, []);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!blockTypeId) throw new Error("블록 타입을 불러오지 못했습니다.");
      if (!title.trim()) throw new Error("제목을 입력해주세요.");
      const post = await createPost({
        block_type: blockTypeId,
        title: title.trim(),
        content: content.trim(),
        node_ids: [],
      });
      if (images.length > 0) {
        await uploadPostAttachments(post.id, images);
      }
      return post;
    },
    onSuccess: () => {
      feedback.success("버그 제보가 등록되었습니다.");
      setTitle("");
      setContent("");
      previews.forEach(URL.revokeObjectURL);
      setImages([]);
      setPreviews([]);
      qc.invalidateQueries({ queryKey: ["dev-posts", "bug_report"] });
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (postId: number) => deletePost(postId),
    onSuccess: () => {
      feedback.success("삭제되었습니다.");
      qc.invalidateQueries({ queryKey: ["dev-posts", "bug_report"] });
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  return (
    <div className={styles.panel}>
      {/* 안내 */}
      <div className={styles.guide}>
        <Bug size={18} className={styles.guideIcon} />
        <div>
          <p className={styles.guideTitle}>버그 발견 시 스크린샷을 첨부해주세요</p>
          <p className={styles.guideDesc}>
            <kbd>F12</kbd> 키로 개발자 도구를 연 상태에서 <kbd>PrtSc</kbd> 키로 화면을 캡처한 뒤,
            아래 입력란에서 <kbd>Ctrl</kbd>+<kbd>V</kbd>로 이미지를 붙여넣을 수 있습니다.
          </p>
        </div>
      </div>

      {/* 작성 폼 */}
      <div className={styles.form}>
        <input
          type="text"
          className={styles.titleInput}
          placeholder="버그 제목 (어떤 문제인지 간략히)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className={styles.contentWrap}>
          <textarea
            ref={contentRef}
            className={styles.contentInput}
            placeholder="버그 상세 내용을 입력하세요. Ctrl+V로 스크린샷 붙여넣기 가능"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            rows={5}
          />
          {previews.length > 0 && (
            <div className={styles.imageGrid}>
              {previews.map((src, i) => (
                <div key={i} className={styles.imageThumb}>
                  <img src={src} alt={`첨부 ${i + 1}`} />
                  <button type="button" className={styles.imageRemove} onClick={() => removeImage(i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.formActions}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <button type="button" className={styles.attachBtn} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={16} />
            이미지 첨부
          </button>
          <Button
            intent="primary"
            size="sm"
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending || !title.trim()}
          >
            <Send size={14} style={{ marginRight: 4 }} />
            {submitMut.isPending ? "등록 중..." : "제보하기"}
          </Button>
        </div>
      </div>

      {/* 내 제보 목록 */}
      <PostList
        posts={posts?.results ?? []}
        emptyText="아직 제보한 버그가 없습니다."
        onDelete={(id) => deleteMut.mutate(id)}
        toneBadge="bug"
      />
    </div>
  );
}

// ═══════════════════ 피드백 패널 ═══════════════════

function FeedbackPanel() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: blockTypeId } = useQuery({
    queryKey: ["dev-block-type", "dev_feedback"],
    queryFn: ensureDevFeedbackBlockType,
    staleTime: Infinity,
  });

  const { data: posts } = useQuery({
    queryKey: ["dev-posts", "dev_feedback", blockTypeId],
    queryFn: () => fetchAdminPosts({ blockTypeId: blockTypeId!, pageSize: 50 }),
    enabled: blockTypeId != null,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!blockTypeId) throw new Error("블록 타입을 불러오지 못했습니다.");
      if (!title.trim()) throw new Error("제목을 입력해주세요.");
      const post = await createPost({
        block_type: blockTypeId,
        title: title.trim(),
        content: content.trim(),
        node_ids: [],
      });
      if (files.length > 0) {
        await uploadPostAttachments(post.id, files);
      }
      return post;
    },
    onSuccess: () => {
      feedback.success("피드백이 등록되었습니다.");
      setTitle("");
      setContent("");
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["dev-posts", "dev_feedback"] });
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (postId: number) => deletePost(postId),
    onSuccess: () => {
      feedback.success("삭제되었습니다.");
      qc.invalidateQueries({ queryKey: ["dev-posts", "dev_feedback"] });
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  return (
    <div className={styles.panel}>
      <div className={styles.guide}>
        <MessageSquare size={18} className={styles.guideIcon} />
        <div>
          <p className={styles.guideTitle}>서비스 개선 의견을 보내주세요</p>
          <p className={styles.guideDesc}>
            기능 요청, 개선 사항, 사용 중 불편했던 점 등 자유롭게 작성해주세요.
          </p>
        </div>
      </div>

      <div className={styles.form}>
        <input
          type="text"
          className={styles.titleInput}
          placeholder="피드백 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={styles.contentInput}
          placeholder="상세 내용을 입력하세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
        />
        {files.length > 0 && (
          <div className={styles.fileList}>
            {files.map((f, i) => (
              <div key={i} className={styles.fileItem}>
                <Paperclip size={14} />
                <span className={styles.fileName}>{f.name}</span>
                <button type="button" className={styles.fileRemoveBtn} onClick={() => removeFile(i)}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.formActions}>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <button type="button" className={styles.attachBtn} onClick={() => fileRef.current?.click()}>
            <Paperclip size={16} />
            파일 첨부
          </button>
          <Button
            intent="primary"
            size="sm"
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending || !title.trim()}
          >
            <Send size={14} style={{ marginRight: 4 }} />
            {submitMut.isPending ? "등록 중..." : "보내기"}
          </Button>
        </div>
      </div>

      <PostList
        posts={posts?.results ?? []}
        emptyText="아직 보낸 피드백이 없습니다."
        onDelete={(id) => deleteMut.mutate(id)}
        toneBadge="feedback"
      />
    </div>
  );
}

// ═══════════════════ 공통: 게시물 목록 ═══════════════════

function PostList({
  posts,
  emptyText,
  onDelete,
  toneBadge,
}: {
  posts: PostEntity[];
  emptyText: string;
  onDelete: (id: number) => void;
  toneBadge: "bug" | "feedback";
}) {
  if (posts.length === 0) {
    return <div className={styles.empty}>{emptyText}</div>;
  }
  return (
    <div className={styles.postList}>
      <h3 className={styles.listTitle}>내 {toneBadge === "bug" ? "제보" : "피드백"} 내역</h3>
      {posts.map((p) => (
        <div key={p.id} className={styles.postCard}>
          <div className={styles.postHeader}>
            <span className={styles.postBadge} data-tone={toneBadge}>
              {toneBadge === "bug" ? "버그" : "피드백"}
            </span>
            <span className={styles.postTitle}>{p.title}</span>
            <span className={styles.postDate}>
              {new Date(p.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
          {p.content && <p className={styles.postContent}>{p.content}</p>}
          {(p.attachments?.length ?? 0) > 0 && (
            <div className={styles.postAttachments}>
              <Paperclip size={12} />
              <span>첨부 {p.attachments!.length}개</span>
            </div>
          )}
          {(p.replies_count ?? 0) > 0 && (
            <div className={styles.postReply}>
              <MessageSquare size={12} />
              <span>개발자 응답 {p.replies_count}건</span>
            </div>
          )}
          <button
            type="button"
            className={styles.postDeleteBtn}
            onClick={() => onDelete(p.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
