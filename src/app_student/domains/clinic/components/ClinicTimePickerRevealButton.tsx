import type { RefObject } from "react";

import styles from "./ClinicTimePickerRevealButton.module.css";

type Props = {
  pickerHeadingRef: RefObject<HTMLHeadingElement | null>;
};

export default function ClinicTimePickerRevealButton({ pickerHeadingRef }: Props) {
  const revealTimePicker = () => {
    pickerHeadingRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    pickerHeadingRef.current?.focus({ preventScroll: true });
  };

  return (
    <button type="button" className={styles.button} onClick={revealTimePicker}>
      아래에서 시간 선택
    </button>
  );
}
