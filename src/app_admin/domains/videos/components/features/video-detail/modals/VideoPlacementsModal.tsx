import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { fetchLectures, fetchSessions, sortSessionsByDisplayOrder } from "@/shared/api/contracts/sessions";
import { useConfirm } from "@/shared/ui/confirm";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import {
  changeVideoPlacements,
  fetchVideoPlacements,
  type VideoPlacementChange,
} from "../../../../api/videos.api";
import { adminVideoQueryKeys } from "../../../../queryKeys";
import styles from "./VideoPlacementsModal.module.css";

const placementsKey = (videoId: number) => ["video-placements", videoId] as const;
const limit = 50;

function toggle(set: number[], id: number, checked: boolean): number[] {
  return checked ? [...set, id] : set.filter((selected) => selected !== id);
}

export default function VideoPlacementsModal({
  videoId, onClose, onCurrentDetached,
}: {
  videoId: number;
  onClose: () => void;
  onCurrentDetached: () => void;
}) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [lectureId, setLectureId] = useState(0);
  const [add, setAdd] = useState<number[]>([]);
  const [remove, setRemove] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const placements = useQuery({
    queryKey: placementsKey(videoId),
    queryFn: ({ signal }) => fetchVideoPlacements(videoId, signal),
  });
  const canAttach = placements.data?.can_attach === true;
  const lectures = useQuery({
    queryKey: ["video-placement-active-lectures"],
    queryFn: () => fetchLectures({ is_active: true }),
    enabled: canAttach,
  });
  const sessions = useQuery({
    queryKey: ["video-placement-lecture-sessions", lectureId],
    queryFn: () => fetchSessions(lectureId),
    enabled: canAttach && lectureId > 0,
  });
  const change = useMutation({
    mutationFn: (operation: VideoPlacementChange) => changeVideoPlacements(videoId, operation),
    onMutate: () => setNotice(""),
    onSuccess: (data, operation) => {
      void queryClient.invalidateQueries({ queryKey: ["video-placements"] });
      queryClient.setQueryData(placementsKey(videoId), data);
      void queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.sessionVideos });
      void queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.landingStats });
      if ("add_session_ids" in operation) {
        setAdd([]);
        setNotice("선택한 차시에 연결했습니다.");
      } else {
        setRemove([]);
        setNotice("선택한 연결을 해제했습니다.");
        if (operation.remove_video_ids.includes(videoId)) {
          onClose();
          onCurrentDetached();
        }
      }
    },
  });
  const used = new Set(placements.data?.placements.map((placement) => placement.session_id));
  const missing = "영상 연결을 불러오지 못했습니다.";

  async function detach() {
    if (!remove.length || change.isPending) return;
    const selection = [...remove];
    if (await confirm({
      title: "영상 연결 해제",
      message: `${selection.length}개 차시에서 이 영상의 시청을 종료합니다. 다른 차시의 영상과 기존 시청 기록은 유지됩니다.`,
      confirmText: "연결 해제",
      danger: true,
    })) {
      change.mutate({ remove_video_ids: selection });
    }
  }

  return <AdminModal open onClose={onClose} width={660} noMinimize trapFocus closeDisabled={change.isPending}>
    <ModalHeader title="영상 사용 차시 관리" description="같은 파일을 여러 차시에서 사용합니다. 시청 권한과 진도는 각 차시에서 관리합니다." />
    <ModalBody>
      <div className={styles.body}>
        {placements.isPending && <p role="status">사용 중인 차시를 확인하고 있습니다.</p>}
        {placements.isError && <p role="alert">{missing} <button type="button" onClick={() => void placements.refetch()}>다시 시도</button></p>}
        {placements.data && <>
          <section aria-label="사용 중인 차시">
            <h3>사용 중인 차시</h3>
            {placements.data.placements.length === 0 && <p>현재 연결된 차시가 없습니다.</p>}
            <ul className={styles.list}>
              {placements.data.placements.map((placement) => {
                const title = `${placement.lecture_title} · ${placement.session_title}`;
                return <li key={placement.video_id}>
                  {!placement.is_original && <input type="checkbox" aria-label={`${title} 연결 해제 선택`}
                    checked={remove.includes(placement.video_id)}
                    disabled={change.isPending || (remove.length >= limit && !remove.includes(placement.video_id))}
                    onChange={(event) => setRemove((selected) => toggle(selected, placement.video_id, event.target.checked))} />}
                  <Link onClick={onClose} to={`/workspace/videos/tree?videoId=${placement.video_id}&lectureId=${placement.lecture_id}&sessionId=${placement.session_id}`}>
                    {title}
                  </Link>
                  {placement.is_original && <small>처음 올린 차시</small>}
                </li>;
              })}
            </ul>
            {remove.length > 0 && <Button intent="danger" disabled={change.isPending} onClick={() => void detach()}>
              선택한 {remove.length}개 연결 해제
            </Button>}
          </section>
          <section aria-label="다른 차시에 연결">
            <h3>다른 차시에 연결</h3>
            {!canAttach ? <p>재생 준비가 완료된 학원 영상만 다른 차시에 연결할 수 있습니다.</p> : <>
              <label className={styles.picker}>강의
                <select value={lectureId} onChange={(event) => setLectureId(Number(event.target.value))}
                  disabled={lectures.isPending || change.isPending}>
                  <option value={0}>강의를 선택하세요</option>
                  {lectures.data?.filter((lecture) => !lecture.is_system).map((lecture) =>
                    <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}
                </select>
              </label>
              {lectures.isError && <p role="alert">강의를 불러오지 못했습니다. <button type="button" onClick={() => void lectures.refetch()}>다시 시도</button></p>}
              {lectureId > 0 && sessions.isPending && <p role="status">차시를 불러오고 있습니다.</p>}
              {sessions.isError && <p role="alert">차시를 불러오지 못했습니다. <button type="button" onClick={() => void sessions.refetch()}>다시 시도</button></p>}
              {sessions.data?.length === 0 && <p>이 강의에 연결할 차시가 없습니다.</p>}
              <ul className={styles.list}>
                {sortSessionsByDisplayOrder(sessions.data ?? []).map((session) => {
                  const alreadyUsed = used.has(session.id);
                  return <li key={session.id}>
                    <label>
                      <input type="checkbox" checked={alreadyUsed || add.includes(session.id)}
                        disabled={alreadyUsed || change.isPending || (add.length >= limit && !add.includes(session.id))}
                        onChange={(event) => setAdd((selected) => toggle(selected, session.id, event.target.checked))} />
                      {session.display_label || session.title}{session.section_label ? ` (${session.section_label}반)` : ""}
                    </label>
                    {alreadyUsed && <small>연결됨</small>}
                  </li>;
                })}
              </ul>
              {add.length > 0 && <div className={styles.actions}>
                <Button intent="primary" disabled={change.isPending} onClick={() => change.mutate({ add_session_ids: add })}>
                  선택한 {add.length}개 차시에 연결
                </Button>
                <Button intent="secondary" disabled={change.isPending} onClick={() => setAdd([])}>선택 초기화</Button>
              </div>}
            </>}
          </section>
        </>}
        {notice && <p role="status">{notice}</p>}
        {change.isError && <p role="alert">{getApiErrorMessage(change.error, "연결을 변경하지 못했습니다. 다시 시도해 주세요.")}</p>}
      </div>
    </ModalBody>
    <ModalFooter right={<Button intent="secondary" onClick={onClose} disabled={change.isPending}>닫기</Button>} />
  </AdminModal>;
}
