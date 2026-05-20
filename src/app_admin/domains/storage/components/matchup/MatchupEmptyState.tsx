// PATH: src/app_admin/domains/storage/components/matchup/MatchupEmptyState.tsx

import { FileSearch, MessageCircle, BookOpen, ClipboardList, FolderOpen, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ICON, Button } from "@/shared/ui/ds";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "./MatchupEmptyState.module.css";

type Props = { onUpload: (intent?: "reference" | "test") => void };

export default function MatchupEmptyState({ onUpload }: Props) {
  const navigate = useNavigate();
  return (
    <div className={css.placeholder}>
      <div className={css.placeholderIcon}>
        <FileSearch size={28} />
      </div>
      <h3 className={css.placeholderTitle}>AI 매치업</h3>
      <p className={`${css.placeholderDesc} ${styles.description}`}>
        <strong>교재·기출(참고 자료)</strong>을 먼저 등록한 뒤, 학생이 본 <strong>시험지</strong>를 올리면<br />
        AI가 자료에서 유사 문제를 찾아드립니다.
      </p>

      {/* 카드 결정 전 컨텍스트 — 어떤 카드를 누르든 같은 목록에 들어가 자동 비교된다는 사실을
          *위쪽*에 두어, 학원장이 "두 카드 중 어느 쪽을 골라야 하지?" 망설이는 시간을 줄인다.
          (이전 위치는 카드 *밑*이라 결정 후에야 보이는 결함.) */}
      <div className={styles.contextNote}>
        <Info size={ICON.sm} className={styles.contextIcon} />
        <span>두 종류 모두 같은 자료 목록에 등록되며 서로 자동 비교됩니다. 무엇부터 올릴지만 고르면 됩니다.</span>
      </div>

      {/* 두 가지 진입점 — 사용자 의도 가시화 (시스템 동작은 동일) */}
      <div className={styles.uploadGrid}>
        <button
          type="button"
          onClick={() => onUpload("reference")}
          data-testid="matchup-empty-reference-btn"
          className={styles.uploadCard}
          data-kind="reference"
        >
          <div className={styles.uploadCardTitle} data-kind="reference">
            <BookOpen size={ICON.md} />
            <span>참고 자료 업로드</span>
          </div>
          <span className={styles.uploadCardDesc}>
            교재·기출 PDF를 등록해 두면 학생 시험지와 비교할 풀이 만들어집니다.
          </span>
        </button>

        <button
          type="button"
          onClick={() => onUpload("test")}
          data-testid="matchup-empty-test-btn"
          className={styles.uploadCard}
          data-kind="test"
        >
          <div className={styles.uploadCardTitle} data-kind="test">
            <ClipboardList size={ICON.md} />
            <span>학생 시험지 업로드</span>
          </div>
          <span className={styles.uploadCardDesc}>
            분석할 시험지를 올리면 등록된 자료에서 유사 문제를 찾아 추천합니다.
          </span>
        </button>
      </div>

      <Button
        size="sm"
        intent="ghost"
        onClick={() => navigate("/admin/storage/files")}
        data-testid="matchup-empty-storage-link"
        leftIcon={<FolderOpen size={ICON.sm} />}
        className={styles.storageLink}
      >
        저장소에서 가져오기
      </Button>

      <div className={css.placeholderSteps}>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>1</span>
          <span>참고 자료 등록 (교재/기출)</span>
        </div>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>2</span>
          <span>학생 시험지 업로드</span>
        </div>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>3</span>
          <span>AI 유사 문제 추천</span>
        </div>
      </div>

      {/* Q&A 연동 안내 */}
      <div className={styles.qnaNote}>
        <MessageCircle size={ICON.md} className={styles.qnaIcon} />
        <span className={styles.qnaText}>
          학생이 QnA에 문제 사진을 올리면, 매치업에 등록된 유사 문제를 자동으로 찾아 선생님 화면에 표시해 줍니다.
        </span>
      </div>
    </div>
  );
}
