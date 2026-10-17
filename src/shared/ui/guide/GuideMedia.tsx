import { useRef, useState } from "react";
import type { GuideMediaSource } from "./guideMediaData";
import styles from "./GuideMedia.module.css";

export default function GuideMedia({ media }: { media: GuideMediaSource }) {
  const [current, setCurrent] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const screen = media.screens[current];

  function selectScreen(index: number) {
    setCurrent(index);
    setImageFailed(false);
  }

  return (
    <section className={styles.media} aria-label="화면으로 따라하기">
      <div className={styles.heading}>
        <h3>화면으로 따라하기</h3>
        <p>예시 데이터로 촬영한 실제 프로그램 화면입니다.</p>
      </div>
      {media.video && (
        <details className={styles.videoSection} onToggle={(event) => { if (!event.currentTarget.open) video.current?.pause(); }}>
          <summary>▶ 짧은 시연 보기 <span>{media.video.duration} · 무음·자막</span></summary>
          {videoFailed ? (
            <div className={styles.failure} role="status">
              <p>영상을 불러오지 못했습니다. 아래 사진으로도 같은 순서를 따라갈 수 있습니다.</p>
              <button type="button" onClick={() => { setVideoFailed(false); setRetry(retry + 1); }}>영상 다시 불러오기</button>
              <a href={media.video.src} download>영상 파일 내려받기</a>
            </div>
          ) : (
            <video ref={video} key={retry} controls playsInline preload="none" poster={media.video.poster}
              aria-label={`${media.title} 시연 영상`} onError={() => setVideoFailed(true)}>
              <source src={media.video.src} type="video/mp4" />
              <track kind="captions" src={media.video.captions} srcLang="ko" label="한국어 설명" />
            </video>
          )}
          <a className={styles.download} href={media.video.src} download>자막 포함 영상 내려받기 ↓</a>
        </details>
      )}
      <div className={styles.screenChoices} role="group" aria-label="따라할 화면 선택">
        {media.screens.map((item, index) => (
          <button key={item.src} type="button" aria-pressed={current === index}
            onClick={() => selectScreen(index)}>
            <span aria-hidden="true">{index + 1}</span>{item.title}
          </button>
        ))}
      </div>
      <figure className={styles.figure}>
        {imageFailed ? (
          <div className={styles.failure} role="status">
            <p>사진을 불러오지 못했습니다. 아래 글 안내를 확인하거나 다시 불러와 주세요.</p>
            <button type="button" onClick={() => { setImageFailed(false); setRetry(retry + 1); }}>사진 다시 불러오기</button>
          </div>
        ) : (
          <button type="button" className={styles.imageButton} onClick={() => dialog.current?.showModal()}
            aria-label={`${screen.title} 사진 크게 보기`}>
            <img key={`${screen.src}-${retry}`} src={screen.src} alt={screen.alt} loading="lazy"
              decoding="async" onError={() => setImageFailed(true)} />
            <span className={styles.enlarge}>사진 크게 보기 ↗</span>
          </button>
        )}
        <figcaption aria-live="polite">
          <strong>{current + 1}. {screen.title}</strong>
          <span>{screen.description}</span>
        </figcaption>
      </figure>
      <div className={styles.controls}>
        <button type="button" disabled={current === 0} onClick={() => selectScreen(current - 1)}>← 이전 화면</button>
        <span>{current + 1} / {media.screens.length}</span>
        <button type="button" disabled={current === media.screens.length - 1} onClick={() => selectScreen(current + 1)}>다음 화면 →</button>
      </div>
      <dialog ref={dialog} className={styles.lightbox} aria-label={`${screen.title} 사진 확대`}>
        <div className={styles.lightboxHeader}>
          <strong>{screen.title}</strong>
          <button type="button" onClick={() => dialog.current?.close()}>닫기 ✕</button>
        </div>
        <div className={styles.zoomScroll}>
          <img src={screen.src} alt={screen.alt} />
        </div>
        <p>{screen.description}</p>
        <a href={screen.src} download>사진 파일 내려받기</a>
      </dialog>
    </section>
  );
}
