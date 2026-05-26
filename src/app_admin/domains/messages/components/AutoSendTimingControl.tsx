import type { AutoSendConfigItem, DelayMode } from "../api/messages.api";
import {
  coerceDelayValue,
  defaultDelayValue,
  getReminderUnit,
  isReminderTrigger,
} from "../utils/autoSendTiming";
import styles from "./AutoSendTimingControl.module.css";

type AutoSendTimingControlProps = {
  config: AutoSendConfigItem;
  disabled?: boolean;
  onUpdate: (config: Partial<AutoSendConfigItem>, debounce?: boolean) => void;
};

export default function AutoSendTimingControl({
  config,
  disabled = false,
  onUpdate,
}: AutoSendTimingControlProps) {
  const patch = (next: Partial<AutoSendConfigItem>, debounce = false) => {
    onUpdate({ ...config, ...next }, debounce);
  };

  if (isReminderTrigger(config.trigger)) {
    return (
      <div className={styles.timeInputGroup}>
        <input
          type="number"
          min={0}
          step={5}
          placeholder="0"
          className={`ds-input ${styles.reminderInput}`}
          value={config.minutes_before ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            patch(
              {
                minutes_before: value === "" ? null : Math.max(0, Number.parseInt(value, 10) || 0),
              },
              true,
            );
          }}
          disabled={disabled}
          aria-label={`발송 시점 (${getReminderUnit(config.trigger)})`}
        />
        <span className={styles.unit}>
          {getReminderUnit(config.trigger)}
        </span>
      </div>
    );
  }

  const delayMode = config.delay_mode ?? "immediate";

  return (
    <div className={styles.delayStack}>
      <select
        className={`ds-select ${styles.delaySelect}`}
        value={delayMode}
        onChange={(e) => {
          const mode = e.target.value as DelayMode;
          patch({
            delay_mode: mode,
            delay_value: coerceDelayValue(mode, config.delay_value),
          });
        }}
        disabled={disabled}
      >
        <option value="immediate">즉시 발송</option>
        <option value="delay_minutes">N분 후 발송</option>
        <option value="scheduled_hour">지정 시각 발송</option>
      </select>
      {delayMode === "delay_minutes" && (
        <div className={styles.timeInputGroup}>
          <input
            type="number"
            min={1}
            step={10}
            placeholder={String(defaultDelayValue("delay_minutes"))}
            className={`ds-input ${styles.delayMinutesInput}`}
            value={config.delay_value ?? defaultDelayValue("delay_minutes") ?? ""}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              patch(
                { delay_value: Number.isFinite(parsed) ? Math.max(1, parsed) : defaultDelayValue("delay_minutes") },
                true,
              );
            }}
            disabled={disabled}
          />
          <span className={styles.unitSmall}>분 후</span>
        </div>
      )}
      {delayMode === "scheduled_hour" && (
        <div className={styles.timeInputGroup}>
          <select
            className={`ds-select ${styles.scheduledHourSelect}`}
            value={coerceDelayValue("scheduled_hour", config.delay_value) ?? 9}
            onChange={(e) => patch({ delay_value: Number.parseInt(e.target.value, 10) })}
            disabled={disabled}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>{`${String(hour).padStart(2, "0")}:00`}</option>
            ))}
          </select>
          <span className={styles.unitSmall}>발송</span>
        </div>
      )}
    </div>
  );
}
