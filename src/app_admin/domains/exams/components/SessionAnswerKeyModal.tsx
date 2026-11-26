import type { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLectures, fetchSessions } from "@/shared/api/contracts/sessions";
import { adminExamsQueryKeys } from "../queryKeys";
import AnswerKeyRegisterModal from "./AnswerKeyRegisterModal";

type Props = Omit<ComponentProps<typeof AnswerKeyRegisterModal>, "lectureName" | "sessionName"> & {
  lectureId: number;
  sessionId: number;
};

export default function SessionAnswerKeyModal({ lectureId, sessionId, ...props }: Props) {
  const lectures = useQuery({
    queryKey: adminExamsQueryKeys.lecturesForOmr,
    queryFn: () => fetchLectures(),
    enabled: lectureId > 0,
  });
  const sessions = useQuery({
    queryKey: adminExamsQueryKeys.sessionsForOmr(lectureId),
    queryFn: () => fetchSessions(lectureId),
    enabled: lectureId > 0,
  });
  return <AnswerKeyRegisterModal {...props}
    lectureName={lectures.data?.find(lecture => lecture.id === lectureId)?.title ?? ""}
    sessionName={sessions.data?.find(session => session.id === sessionId)?.title ?? ""} />;
}
