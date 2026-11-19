import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { resolveTenantCodeString } from "@/shared/tenant";
import { feedback } from "@/shared/ui/feedback";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import ClassRosterModal from "./ClassRosterModal";

type LectureGroup = { group_id: number | null; name: string; school: string };
const root = "/students/class-groups/";

export function useDawonLectureGroup(lectureId: number, enabled: boolean) {
  const isDawon = resolveTenantCodeString() === "dawon";
  const query = useQuery({
    queryKey: ["dawon", "lecture-group", lectureId],
    enabled: isDawon && enabled && Number.isInteger(lectureId) && lectureId > 0,
    queryFn: async ({ signal }) => (await api.get<LectureGroup>(`${root}for-lecture/${lectureId}/`, { signal })).data,
  });
  return { isDawon, query };
}

export function DawonLectureEnrollment({
  lectureId, group, onClose, onSaved,
}: { lectureId: number; group: LectureGroup; onClose: () => void; onSaved: () => void }) {
  const endpoint = `${root}${group.group_id}/lectures/${lectureId}/late-students/`;
  return <ClassRosterModal
    title="합류 학생 수강 등록"
    description={`${group.name}${group.school ? ` · ${group.school}` : ""}에서 아직 이 수업에 등록되지 않은 학생을 선택하세요.`}
    candidateUrl={endpoint}
    submitLabel="수강 등록"
    onClose={onClose}
    onSave={async (student_ids) => {
      await api.post(endpoint, { student_ids });
      onSaved();
      onClose();
      feedback.success(`${student_ids.length}명을 수강 등록했습니다.`);
    }}
  />;
}

export function DawonLectureGroupPending({ error, retry, onClose }: {
  error: boolean; retry: () => void; onClose: () => void;
}) {
  return <AdminModal open onClose={onClose} width={460} noMinimize trapFocus>
    <ModalHeader title="수강생 등록" />
    <ModalBody>{error
      ? <p role="alert">소속 반을 확인하지 못했습니다. 다시 시도해 주세요.</p>
      : <p role="status">강의의 소속 반을 확인하고 있습니다.</p>}</ModalBody>
    <ModalFooter right={error ? <Button onClick={retry}>다시 시도</Button> : <Button onClick={onClose}>닫기</Button>} />
  </AdminModal>;
}
