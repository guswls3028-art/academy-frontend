import { useContext } from 'react';
import { SessionScheduleControlsContext } from './sessionScheduleControlsContext';
import styles from './SessionBlock.module.css';

export function CompactSessionScheduleCard() {
  const controls = useContext(SessionScheduleControlsContext);
  if (!controls) return null;
  const { title, date, inlineActions } = controls;
  return (
    <section className={styles.activeCard} data-inline={inlineActions} aria-label={`${title} 차시 카드`}>
      <span className={styles.compactCardTitle}>{title}{date && !inlineActions ? <small>{date}</small> : null}</span>
      {controls.content}
    </section>
  );
}
