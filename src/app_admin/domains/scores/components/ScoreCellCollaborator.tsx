import { useState } from "react";
import useAuth from "@/auth/hooks/useAuth";
import type { ScoreActiveCell, ScoreActiveEditor } from "../api/scoreDraft";
import { isScoreEditLockedError } from "../api/scoreDraft";

type Props = {
  editor: ScoreActiveEditor;
  onClaim?: (cell: ScoreActiveCell) => Promise<boolean>;
  onClaimed: () => void;
};

export default function ScoreCellCollaborator({ editor, onClaim, onClaimed }: Props) {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const own = editor.editor_user_id === user?.id;
  return (
    <span className="ds-scores-collaborator">
      <span className="ds-scores-collaborator-label">
        {own ? "내 다른 화면에서 입력 중" : `${editor.editor_name} 입력 중`}
      </span>
      {own && editor.has_pending_changes === true && (
        <span className="ds-scores-collaborator-help">다른 화면의 입력을 먼저 저장해 주세요.</span>
      )}
      {own && editor.has_pending_changes === false && onClaim && (
        <button type="button" disabled={pending} aria-busy={pending}
          onClick={async (event) => {
            event.stopPropagation();
            if (pending) return;
            setPending(true);
            setError(null);
            try {
              if (await onClaim(editor.active_cell)) window.requestAnimationFrame(onClaimed);
            } catch (error) {
              setError(isScoreEditLockedError(error)
                ? "다른 화면에 저장하지 않은 입력이 있거나 다른 직원이 입력 중입니다. 그 화면에서 저장한 뒤 다시 시도해 주세요."
                : "이 화면에서 입력을 이어가지 못했습니다. 입력값은 보존했습니다. 다시 시도해 주세요.");
            } finally {
              setPending(false);
            }
          }}>
          {pending ? "입력 준비 중…" : "이 화면에서 이어 입력"}
        </button>
      )}
      {error && <span className="ds-scores-collaborator-help" role="alert">{error}</span>}
    </span>
  );
}
