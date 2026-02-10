// PATH: src/shared/ui/ds/components/ActionButton.tsx
import { Button } from "@/shared/ui/ds";
import type { ButtonIntent, ButtonSize } from "@/shared/ui/ds/Button";

type Action =
  | "create"
  | "edit"
  | "delete"
  | "close"
  | "manage";

const ACTION_PRESET: Record<
  Action,
  { intent: ButtonIntent; label: string }
> = {
  create: { intent: "primary", label: "생성" },
  edit: { intent: "secondary", label: "수정" },
  manage: { intent: "secondary", label: "관리" },
  close: { intent: "ghost", label: "닫기" },
  delete: { intent: "danger", label: "삭제" },
};

export default function ActionButton({
  action,
  size = "md",
  children,
  ...props
}: {
  action: Action;
  size?: ButtonSize;
} & React.ComponentProps<typeof Button>) {
  const preset = ACTION_PRESET[action];

  return (
    <Button
      intent={preset.intent}
      size={size}
      {...props}
    >
      {children ?? preset.label}
    </Button>
  );
}
