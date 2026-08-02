// PATH: src/shared/ui/modal/AdminModal.tsx
import { Modal, type ModalProps } from "antd";
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { BRAND_AND_LIGHT_THEMES, MODAL_DEFAULT_WIDTH } from "./constants";
import { useModalKeyboard } from "./useModalKeyboard";
import { useDraggableModal } from "./useDraggableModal";
import { useModalWindow } from "./ModalWindowContext";
import ModalHeader, { type ModalHeaderProps } from "./ModalHeader";

export type AdminModalType = "action" | "confirm" | "inspect";

function getModalBackground(): string {
  const theme = document.documentElement.getAttribute("data-theme") || "";
  return BRAND_AND_LIGHT_THEMES.has(theme) ? "#ffffff" : "var(--color-modal-bg)";
}

type AdminModalProps = {
  open: boolean;
  onClose: () => void;
  type?: AdminModalType;
  width?: number | string;
  /** 모달 위에 또 다른 모달을 띄울 때 상위 모달에 더 높은 값 지정 (기본 1000) */
  zIndex?: number;
  /** 추가 클래스명 (화면별 반응형 조정용) */
  className?: string;
  /** Enter 키로 긍정 버튼(등록/적용/확인) 실행. textarea 포커스 시에는 동작하지 않음 */
  onEnterConfirm?: () => void;
  /** 우측 상단 최소화 버튼(━) 숨김 — 단발성 모달(발송/확인 등)에서 사용 */
  noMinimize?: boolean;
  /** 저장·처리 중 Escape, 배경, 닫기 버튼으로 이탈하지 못하게 함 */
  closeDisabled?: boolean;
  children: React.ReactNode;
};

function findModalTitle(children: React.ReactNode): React.ReactNode | undefined {
  let title: React.ReactNode | undefined;
  React.Children.forEach(children, (child) => {
    if (title !== undefined || !React.isValidElement(child)) return;
    if (child.type === ModalHeader) {
      title = (child.props as ModalHeaderProps).title;
      return;
    }
    if (child.type === React.Fragment) {
      title = findModalTitle((child.props as { children?: React.ReactNode }).children);
    }
  });
  return title;
}

function getAccessibleText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!React.isValidElement(node)) return "";
  return React.Children.toArray(
    (node.props as { children?: React.ReactNode }).children,
  )
    .map(getAccessibleText)
    .join("")
    .trim();
}

export default function AdminModal({
  open,
  onClose,
  type = "action",
  width = MODAL_DEFAULT_WIDTH,
  zIndex,
  className,
  onEnterConfirm,
  noMinimize = false,
  closeDisabled = false,
  children,
}: AdminModalProps) {
  const isConfirm = type === "confirm";
  const contentBg = getModalBackground();
  const modalId = useId();
  const ctx = useModalWindow();
  const [minimized, setMinimized] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const accessibleTitle = findModalTitle(children);
  const accessibleTitleText = getAccessibleText(accessibleTitle) || "대화상자";
  const requestClose = () => {
    if (!closeDisabled) onClose();
  };

  const {
    offset,
    onMouseDown,
    onTouchStart,
    dragging,
    inMinimizeZone,
    reset,
    onMinimizeRef,
  } = useDraggableModal(".modal-header");

  // 매 렌더마다 최신 minimize 콜백 할당
  onMinimizeRef.current = ctx
    ? () => {
        const titleEl = wrapperRef.current?.querySelector(".modal-header");
        const title = titleEl?.textContent?.trim() || "모달";
        reset();
        setMinimized(true);
        ctx.minimize({
          id: modalId,
          title,
          type,
          onRestore: () => setMinimized(false),
          onClose: () => {
            if (closeDisabled) return;
            setMinimized(false);
            onClose();
          },
        });
      }
    : null;

  // 모달 닫힐 때 cleanup
  useEffect(() => {
    if (!open) {
      setMinimized(false);
      ctx?.remove(modalId);
      reset();
    }
  }, [open, modalId, ctx, reset]);

  // 컴포넌트 언마운트 시 cleanup
  useEffect(() => {
    return () => {
      ctx?.remove(modalId);
    };
  }, [ctx, modalId]);

  const actuallyOpen = open && !minimized;
  useModalKeyboard(actuallyOpen, requestClose, onEnterConfirm);

  const hasOffset = offset.x !== 0 || offset.y !== 0;
  const baseClass = className
    ? `admin-modal admin-modal--${type} ${className}`
    : `admin-modal admin-modal--${type}`;
  const modalStyles: NonNullable<ModalProps["styles"]> = {
    header: {
      position: "absolute",
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: 0,
    },
    body: {
      padding: 0,
      overflow: "hidden",
    },
    mask: {
      backdropFilter: "blur(3px)",
      backgroundColor: isConfirm
        ? "rgba(0,0,0,0.58)"
        : "rgba(0,0,0,0.42)",
    },
  };

  return (
    <>
      <Modal
        open={actuallyOpen}
        onCancel={requestClose}
        footer={null}
        title={<span aria-label={accessibleTitleText} />}
        width={width}
        centered
        destroyOnHidden
        zIndex={zIndex}
        mask={{ closable: !isConfirm && !closeDisabled }}
        closable={
          !isConfirm && !closeDisabled
            ? { "aria-label": "대화상자 종료" }
            : false
        }
        keyboard={false}
        styles={modalStyles}
        className={baseClass}
        modalRender={(modal) => (
          <div
            ref={wrapperRef}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={
              hasOffset
                ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
                : undefined
            }
          >
            {modal}
          </div>
        )}
      >
        <div
          className="admin-modal__inner"
          style={
            contentBg === "#ffffff"
              ? ({
                  "--color-modal-bg": "#ffffff",
                  "--color-bg-surface": "#ffffff",
                  "--color-bg-surface-hover": "#f8fafc",
                } as React.CSSProperties)
              : undefined
          }
        >
          {/* 최소화 버튼 — confirm 타입 + noMinimize prop 제외 */}
          {!isConfirm && ctx && !noMinimize && !closeDisabled && (
            <button
              type="button"
              className="modal-minimize-btn"
              onClick={() => onMinimizeRef.current?.()}
              title="최소화"
            >
              <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
                <path
                  d="M1 1h10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          {children}
        </div>
      </Modal>

      {/* 드래그 중 하단 최소화 존 인디케이터 */}
      {dragging &&
        createPortal(
          <div
            className={`modal-minimize-zone${inMinimizeZone ? " modal-minimize-zone--active" : ""}`}
          />,
          document.body,
        )}
    </>
  );
}
