import { ArrowRight, FileImage, FolderOpen, Presentation } from "lucide-react";
import styles from "./MatchupPptFileRibbon.module.css";

export default function MatchupPptFileRibbon() {
  return (
    <div className={styles.fileRibbon}>
      <FileImage size={22} />
      <div>
        <span>적중 매치업</span>
        <strong>실제 시험 ↔ 사전 자료</strong>
      </div>
      <span className={styles.divider}>별도 기능</span>
      <FolderOpen size={22} />
      <div>
        <span>PPT 만들기</span>
        <strong>PDF 문항·이미지별 슬라이드</strong>
      </div>
      <ArrowRight size={18} />
      <Presentation size={22} />
      <div>
        <span>강의실</span>
        <strong>흑백반전 칠판 PPT</strong>
      </div>
    </div>
  );
}
