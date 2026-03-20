// PATH: src/features/community/components/CommunityAvatar.tsx
// Shared avatar for all community pages (replaces QnaAvatar, CounselAvatar, BoardAvatar, MatAvatar)

import { getInitials, getAvatarSlot } from "../utils/communityHelpers";

type CommunityAvatarProps = {
  name: string;
  role?: "student" | "teacher" | "admin";
  size?: number;
  className?: string;
};

export default function CommunityAvatar({
  name,
  role = "student",
  size = 32,
  className,
}: CommunityAvatarProps) {
  const isStaff = role === "teacher" || role === "admin";
  const style = size !== 32
    ? { width: size, height: size, fontSize: size * 0.34 }
    : undefined;

  return (
    <div
      className={`qna-inbox__avatar${isStaff ? " qna-inbox__avatar--teacher" : ""}${className ? ` ${className}` : ""}`}
      data-slot={isStaff ? undefined : getAvatarSlot(name)}
      style={style}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}
