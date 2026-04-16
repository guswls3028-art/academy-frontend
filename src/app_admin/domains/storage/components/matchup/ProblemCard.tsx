// PATH: src/app_admin/domains/storage/components/matchup/ProblemCard.tsx

import { useState, useEffect } from "react";
import type { MatchupProblem } from "../../api/matchup.api";
import { getMatchupProblemPresignUrl } from "../../api/matchup.api";

type Props = {
  problem: MatchupProblem;
  selected: boolean;
  onClick: () => void;
};

export default function ProblemCard({ problem, selected, onClick }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (problem.image_key) {
      getMatchupProblemPresignUrl(problem.id)
        .then(setImgUrl)
        .catch(() => setImgUrl(null));
    }
  }, [problem.id, problem.image_key]);

  return (
    <div
      onClick={onClick}
      style={{
        border: selected
          ? "2px solid var(--color-brand-primary)"
          : "1px solid var(--color-border-divider)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-3)",
        cursor: "pointer",
        background: selected
          ? "color-mix(in srgb, var(--color-brand-primary) 4%, var(--color-bg-surface))"
          : "var(--color-bg-surface)",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--color-brand-primary) 12%, transparent)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        minHeight: 120,
      }}
    >
      {/* 문제 번호 */}
      <div style={{
        fontSize: 11, fontWeight: 700,
        color: selected ? "var(--color-brand-primary)" : "var(--color-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        Q{problem.number}
      </div>

      {/* 이미지 */}
      {imgUrl ? (
        <div style={{
          width: "100%", height: 80,
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          background: "var(--color-bg-surface-soft)",
        }}>
          <img
            src={imgUrl}
            alt={`Q${problem.number}`}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      ) : (
        <div style={{
          width: "100%", height: 80,
          borderRadius: "var(--radius-md)",
          background: "var(--color-bg-surface-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "var(--color-text-muted)",
        }}>
          이미지 없음
        </div>
      )}

      {/* 텍스트 미리보기 */}
      {problem.text && (
        <p style={{
          fontSize: 11, color: "var(--color-text-secondary)",
          margin: 0, lineHeight: 1.4,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {problem.text}
        </p>
      )}
    </div>
  );
}
