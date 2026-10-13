import { useEffect, useRef } from "react";
import { Modal } from "antd";
import { X, ArrowUpRight } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import type { VideoContent, VideoSource } from "../api/publicVideos";
import s from "../pages/PublicVideos.module.css";

type Playable = VideoSource & VideoContent;
export function VideoPlayer({ video }: { video: Playable }) {
  const params = new URLSearchParams({ autoplay: "0", playsinline: "1", origin: window.location.origin });
  return <div className={s.playerArea}>
    <div className={`${s.player} ${video.format === "vertical" ? s.verticalPlayer : ""}`}>
      <iframe key={video.youtube_video_id} title={video.title} src={`https://www.youtube.com/embed/${video.youtube_video_id}?${params}`}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
    <p className={s.playerHelp}>플레이어의 재생 버튼을 눌러 시청해주세요. 재생이 제한되면 YouTube에서 볼 수 있습니다.</p>
    <a className={s.external} href={video.canonical_url} target="_blank" rel="noopener noreferrer">YouTube에서 보기 · 좋아요 <ArrowUpRight size={ICON.sm} /></a>
  </div>;
}

export default function VideoDialog({ video, close }: { video: Playable; close: () => void }) {
  const trigger = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => { const element = trigger.current; return () => { element?.focus(); }; }, []);
  return <Modal open centered footer={null} closable={false} onCancel={close} width={880} className={s.dialog} aria-labelledby="video-dialog-title" destroyOnHidden>
    <div className={s.dialogHead}><h2 id="video-dialog-title">{video.title}</h2><button type="button" onClick={close} aria-label="영상 닫기" autoFocus><X size={ICON.md} /></button></div>
    <VideoPlayer video={video} /><p className={s.source}>원본 채널 · {video.channel_title}</p>
  </Modal>;
}
