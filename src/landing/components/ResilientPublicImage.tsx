import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";

type ResilientPublicImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallback: ReactNode;
};

/** 공개 자료 썸네일이 일시적으로 실패해도 깨진 이미지 대신 읽을 수 있는 대체 UI를 남긴다. */
export default function ResilientPublicImage({ fallback, src, onError, ...props }: ResilientPublicImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <>{fallback}</>;

  return (
    <img
      {...props}
      src={src}
      onError={(event) => {
        onError?.(event);
        setFailed(true);
      }}
    />
  );
}
