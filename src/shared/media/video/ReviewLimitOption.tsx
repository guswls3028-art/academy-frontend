import { useId } from "react";
import { originalDurationSeconds, reviewLimitLabel } from "./reviewDuration";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  originalLength?: string;
  onLengthChange?: (value: string) => void;
}

export default function ReviewLimitOption({ checked, onChange, disabled, originalLength = "", onLengthChange }: Props) {
  const id = useId();
  const seconds = originalDurationSeconds(originalLength);
  return <div>
    <label><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /> 복습시간 1.4배 제한</label>
    <p>선택하면 60분 영상은 학생 한 명당 누적 84분까지 복습할 수 있습니다.</p>
    {checked && onLengthChange && <div>
      <label htmlFor={id}>원본 영상 길이 (필수)</label>
      <input id={id} className="ds-input" type="text" value={originalLength} placeholder="예: 60 또는 60:30"
        aria-describedby={id + "-hint"} disabled={disabled} onChange={e => onLengthChange(e.target.value)} />
      <p id={id + "-hint"}>{seconds ? `학생당 복습 한도 ${reviewLimitLabel(seconds)}` :
        "학원 플레이어에서 사용할 원본 길이를 분 또는 분:초로 입력해 주세요. 초는 00~59까지 가능합니다."}</p>
    </div>}
  </div>;
}
