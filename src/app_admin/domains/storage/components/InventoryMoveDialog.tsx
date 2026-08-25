import { useEffect, useId, useMemo, useState } from "react";
import { MoveRight } from "lucide-react";

import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import {
  AdminModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/shared/ui/modal";

import type { InventoryFolder } from "../api/storage.api";

const ROOT_VALUE = "__storage_root__";

export type InventoryMoveOutcome = "moved" | "conflict" | "error";

export type InventoryMoveSource = {
  id: string;
  type: "file" | "folder";
  name: string;
  parentId: string | null;
};

type InventoryMoveDialogProps = {
  folders: InventoryFolder[];
  source: InventoryMoveSource;
  busy: boolean;
  onMove: (targetFolderId: string | null) => Promise<InventoryMoveOutcome>;
  onClose: () => void;
};

type DestinationOption = {
  value: string;
  targetFolderId: string | null;
  label: string;
  disabledReason: string | null;
};

function folderDepth(
  folder: InventoryFolder,
  folderById: Map<string, InventoryFolder>,
): number {
  let depth = 0;
  let parentId = folder.parentId;
  const seen = new Set<string>([folder.id]);

  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = folderById.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }

  return depth;
}

function isDescendantOf(
  folderId: string,
  ancestorId: string,
  folderById: Map<string, InventoryFolder>,
): boolean {
  let currentId: string | null = folderId;
  const seen = new Set<string>();

  while (currentId && !seen.has(currentId)) {
    if (currentId === ancestorId) return true;
    seen.add(currentId);
    currentId = folderById.get(currentId)?.parentId ?? null;
  }

  return false;
}

function buildDestinationOptions(
  folders: InventoryFolder[],
  source: InventoryMoveSource,
): DestinationOption[] {
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const rootReason = source.parentId === null ? "현재 위치" : null;
  const options: DestinationOption[] = [
    {
      value: ROOT_VALUE,
      targetFolderId: null,
      label: "최상위 폴더",
      disabledReason: rootReason,
    },
  ];

  for (const folder of folders) {
    let disabledReason: string | null = null;
    if (folder.id === source.parentId) {
      disabledReason = "현재 위치";
    } else if (
      source.type === "folder"
      && isDescendantOf(folder.id, source.id, folderById)
    ) {
      disabledReason = folder.id === source.id ? "선택한 폴더" : "하위 폴더";
    }

    const depth = folderDepth(folder, folderById);
    options.push({
      value: folder.id,
      targetFolderId: folder.id,
      label: `${"　".repeat(depth)}${folder.name}`,
      disabledReason,
    });
  }

  return options;
}

export default function InventoryMoveDialog({
  folders,
  source,
  busy,
  onMove,
  onClose,
}: InventoryMoveDialogProps) {
  const selectId = useId();
  const descriptionId = useId();
  const options = useMemo(
    () => buildDestinationOptions(folders, source),
    [folders, source],
  );
  const firstAvailable = options.find((option) => !option.disabledReason)?.value ?? "";
  const [selectedValue, setSelectedValue] = useState(firstAvailable);

  useEffect(() => {
    setSelectedValue(firstAvailable);
  }, [firstAvailable, source.id]);

  const selectedOption = options.find(
    (option) => option.value === selectedValue && !option.disabledReason,
  );
  const hasDestination = Boolean(selectedOption);

  const submit = async () => {
    if (busy || !selectedOption) return;
    const outcome = await onMove(selectedOption.targetFolderId);
    if (outcome !== "error") onClose();
  };

  return (
    <AdminModal
      open
      onClose={onClose}
      width={520}
      noMinimize
      closeDisabled={busy}
      onEnterConfirm={hasDestination && !busy ? () => void submit() : undefined}
    >
      <ModalHeader
        title="저장소 항목 이동"
        description="선택한 항목을 옮길 폴더를 지정해 주세요."
        noIcon
      />
      <ModalBody>
        <div className="grid min-w-0 gap-4">
          <div className="min-w-0 rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
            <p className="m-0 text-xs font-semibold text-[var(--color-text-muted)]">
              이동할 항목
            </p>
            <p className="mt-1 mb-0 truncate text-sm font-bold text-[var(--color-text-primary)]">
              {source.type === "folder" ? "폴더" : "파일"} · {source.name}
            </p>
          </div>

          <label
            htmlFor={selectId}
            className="grid min-w-0 gap-2 text-sm font-semibold text-[var(--color-text-primary)]"
          >
            이동할 폴더
            <select
              id={selectId}
              autoFocus
              value={selectedValue}
              onChange={(event) => setSelectedValue(event.target.value)}
              disabled={busy || !firstAvailable}
              aria-describedby={descriptionId}
              className="min-h-12 w-full min-w-0 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-primary)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {!firstAvailable && <option value="">이동할 수 있는 폴더 없음</option>}
              {options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={Boolean(option.disabledReason)}
                >
                  {option.label}
                  {option.disabledReason ? ` (${option.disabledReason})` : ""}
                </option>
              ))}
            </select>
          </label>

          <p
            id={descriptionId}
            className="m-0 text-xs leading-5 text-[var(--color-text-muted)]"
            role={hasDestination ? undefined : "status"}
          >
            {hasDestination
              ? "현재 위치와 선택한 폴더의 하위 폴더는 이동 대상에서 제외됩니다."
              : "현재 항목을 옮길 수 있는 다른 폴더가 없습니다."}
          </p>
        </div>
      </ModalBody>
      <ModalFooter
        right={(
          <>
            <Button
              type="button"
              intent="secondary"
              size="xl"
              className="!min-h-12"
              onClick={onClose}
              disabled={busy}
            >
              취소
            </Button>
            <Button
              type="button"
              intent="primary"
              size="xl"
              className="!min-h-12"
              leftIcon={<MoveRight size={ICON_FOR_BUTTON.xl} />}
              onClick={() => void submit()}
              disabled={!hasDestination}
              loading={busy}
              title={hasDestination ? undefined : "이동할 수 있는 다른 폴더가 없습니다."}
            >
              이동
            </Button>
          </>
        )}
      />
    </AdminModal>
  );
}
