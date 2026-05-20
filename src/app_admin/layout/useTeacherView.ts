import { useContext } from "react";
import { TeacherViewContext } from "./teacherViewState";

export function useTeacherView() {
  return useContext(TeacherViewContext);
}
