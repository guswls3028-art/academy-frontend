import { createRef } from "react";
import { useConfirm } from "@/shared/ui/confirm";
import type { ConfirmOptions } from "@/shared/ui/confirm/ConfirmDialog";
import RegistrationPasswordChoices, { type ChoiceHandle, type PasswordChoiceOptions, type RegistrationPasswordChoice } from "./RegistrationPasswordChoices";

export type { RegistrationPasswordChoice } from "./RegistrationPasswordChoices";

export function useRegistrationPasswordConfirmation() {
  const confirm = useConfirm();
  return async (options: PasswordChoiceOptions & Omit<ConfirmOptions, "content" | "validate" | "rememberKey">): Promise<RegistrationPasswordChoice | null> => {
    const choiceRef = createRef<ChoiceHandle>();
    let value: RegistrationPasswordChoice | null = null;
    const confirmed = await confirm({
      ...options,
      content: <RegistrationPasswordChoices {...options} choiceRef={choiceRef} />,
      validate: () => {
        if (!choiceRef.current?.validate()) return false;
        value = choiceRef.current.value();
        return true;
      },
    });
    return confirmed ? value : null;
  };
}
