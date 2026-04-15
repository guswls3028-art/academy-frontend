import type { ReactNode } from "react";

export type GuideStep = {
  title: string;
  description: string;
};

export type TourStep = {
  selector: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
};

export type GuideWorkflow = {
  id: string;
  icon: ReactNode;
  title: string;
  summary: string;
  steps: GuideStep[];
  tourPath?: string;
  tourSteps?: TourStep[];
};
