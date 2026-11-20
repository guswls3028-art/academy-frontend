import { createContext } from "react";

export type ControlSize = "sm" | "md" | "lg" | "xl";

/** A toolbar/footer owns one size for its actions, including wrapped Buttons. */
export const ControlSizeContext = createContext<ControlSize | null>(null);
