import { useContext } from 'react';
import { SessionScheduleControlsContext } from './sessionScheduleControlsContext';
import styles from './SessionBlock.module.css';

export function CompactSessionScheduleCard() {
  const controls = useContext(SessionScheduleControlsContext);
  if (!controls) return null;
  const { title, date } = controls;
  return (
    <section className={styles.activeCard} aria-label={`${title} 차시 카드`}>
      <span className={styles.compactCardTitle}>{title}{date ? <small>{date}</small> : null}</span>
      {controls.content}
    </section>
  );
}
