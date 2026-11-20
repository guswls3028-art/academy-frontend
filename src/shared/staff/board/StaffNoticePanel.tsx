import { Link } from "react-router";
import { ArrowRight, Megaphone } from "lucide-react";
import { Button, ICON } from "@/shared/ui/ds";
import { boardDate, useBoardList, useBoardScope } from "./api";
import { boardRoot } from "@/core/router/workspaceRoutes";
import styles from "./StaffBoard.module.css";

export default function StaffNoticePanel({ root = boardRoot }: { root?: string }) {
  const scope = useBoardScope();
  const notices = useBoardList(scope, "notice", { pageSize: 3, refreshInterval: 60_000 });
  const path = `${root}/notice`;
  return (
    <section className={styles.noticePanel} aria-label="학원 내부 공지">
      <header className={styles.noticeHeader}>
        <h2><Megaphone size={ICON.md} aria-hidden="true" />학원 내부 공지</h2>
        <Link to={path}>전체 보기<ArrowRight size={ICON.xs} aria-hidden="true" /></Link>
      </header>
      {notices.isError ? (
        <div className={styles.noticeState} role="alert">
          공지를 불러오지 못했습니다.
          <Button size="sm" onClick={() => void notices.refetch()}>다시 시도</Button>
        </div>
      ) : notices.isPending ? (
        <p className={styles.noticeState} role="status">공지를 불러오는 중입니다.</p>
      ) : notices.data.results.length ? (
        <ul className={styles.noticeList}>
          {notices.data.results.map(post => (
            <li key={post.id}>
              <Link to={`${path}/${post.id}`}>
                <span>{post.title}</span><time dateTime={post.created_at}>{boardDate(post.created_at)}</time>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className={styles.noticeState}>아직 등록된 내부 공지가 없습니다.</p>}
    </section>
  );
}
