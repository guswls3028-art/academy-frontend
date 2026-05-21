// PATH: src/shared/ui/layout/useWorkbox.ts
import { useContext } from "react";
import { WorkboxContext } from "./WorkboxContextCore";

export function useWorkbox() {
  return useContext(WorkboxContext);
}
