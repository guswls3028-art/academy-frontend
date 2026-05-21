import { createContext } from "react";
import type { ConfirmOptions } from "./ConfirmDialog";

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);
