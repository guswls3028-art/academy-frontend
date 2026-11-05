import { useNavigate, useSearchParams } from "react-router";
import { Badge, ICON } from "@/shared/ui/ds";
import PageTrail from "@/shared/ui/navigation/PageTrail";
import { ChevronRight, ExternalLink } from "@teacher/shared/ui/Icons";
import { useTeacherNavigation } from "./useTeacherNavigation";
import { TEACHER_MENU_GROUP_IDS } from "@/core/navigation/workspaceSections";
import styles from "./TeacherMenuPage.module.css";

export default function TeacherMenuPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { groups } = useTeacherNavigation();
  const selected = groups.find(group => TEACHER_MENU_GROUP_IDS[group.title] === params.get("group"));
  const visible = selected ? [selected] : groups;
  return (
    <div className={styles.page}>
      <PageTrail items={[{ label: "대시보드", to: "/workspace/mobile" },
        ...(selected ? [{ label: "전체 메뉴", to: "/workspace/mobile/menu" }] : [])]} />
      <header className={styles.header}>
        <h1>{selected?.title ?? "전체 메뉴"}</h1>
        <p>필요한 업무를 선택하면 해당 화면으로 이동합니다.</p>
      </header>
      {visible.map(group => (
        <section key={group.title} className={styles.group} aria-label={group.title}>
          {!selected && <h2>{group.title}</h2>}
          {group.items.map(item => {
            const content = <>
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.copy}><strong>{item.label}</strong>
                {item.keywords?.length ? <span>{item.keywords.slice(0, 3).join(" · ")}</span> : null}
              </span>
              {item.beta && <Badge tone="warning" size="xs">Beta</Badge>}
              {item.badgeLabel && <Badge tone="warning" size="xs">{item.badgeLabel}</Badge>}
              {item.badge != null && item.badge > 0 && <Badge tone="danger" size="xs">{item.badge > 99 ? "99+" : item.badge}</Badge>}
              {item.href ? <ExternalLink size={ICON.sm} aria-hidden /> : <ChevronRight size={ICON.sm} aria-hidden />}
            </>;
            return item.href ? (
              <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className={styles.entry}>{content}</a>
            ) : (
              <button key={item.path} type="button" className={styles.entry} aria-label={item.label}
                data-analytics-destination={item.path} onClick={() => item.path && navigate(item.path)}>{content}</button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
