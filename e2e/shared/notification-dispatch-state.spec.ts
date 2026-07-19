import { test, expect } from "../fixtures/strictTest";
import {
  NotificationRequestLifecycle,
  getNotificationConfirmPresentation,
  notificationConfirmFeedback,
  notificationConfirmHeadline,
} from "../../src/shared/ui/notifications/notificationDispatchState";

test.describe("알림톡 미리보기 요청 상태", () => {
  test("닫기·재열기 중 확정 잠금을 유지하고 완료 뒤 새 미리보기를 요구한다", () => {
    const lifecycle = new NotificationRequestLifecycle();
    const firstPreview = lifecycle.startPreview();
    const firstConfirm = lifecycle.startConfirm("preview-token-a");
    expect(firstConfirm).not.toBeNull();
    if (!firstConfirm) throw new Error("첫 확정 요청이 시작되지 않았습니다.");

    lifecycle.invalidatePreview(firstPreview);
    const secondPreview = lifecycle.startPreview();

    expect(lifecycle.isPreviewCurrent(firstPreview)).toBe(false);
    expect(lifecycle.isConfirmCurrent(firstConfirm)).toBe(false);
    expect(lifecycle.hasConfirmInFlight()).toBe(true);
    expect(lifecycle.startConfirm("preview-token-b")).toBeNull();
    expect(lifecycle.isPreviewCurrent(secondPreview)).toBe(true);

    expect(lifecycle.finishConfirm(firstConfirm)).toEqual({
      released: true,
      needsFreshPreview: true,
    });
    expect(lifecycle.hasConfirmInFlight()).toBe(false);
    const freshPreview = lifecycle.startPreview();
    expect(lifecycle.isPreviewCurrent(freshPreview)).toBe(true);
    expect(lifecycle.startConfirm("preview-token-b")).not.toBeNull();
  });

  test("현재 미리보기의 확정 요청만 완료 처리한다", () => {
    const lifecycle = new NotificationRequestLifecycle();
    lifecycle.startPreview();
    const ticket = lifecycle.startConfirm("preview-token-current");
    expect(ticket).not.toBeNull();
    if (!ticket) throw new Error("확정 요청이 시작되지 않았습니다.");

    expect(lifecycle.isConfirmCurrent(ticket)).toBe(true);
    expect(lifecycle.finishConfirm(ticket)).toEqual({
      released: true,
      needsFreshPreview: false,
    });
    expect(lifecycle.isConfirmCurrent(ticket)).toBe(false);
  });
});

test.describe("알림톡 발송 결과 문구", () => {
  test("대기 건은 완료가 아니라 접수·대기로 표시한다", () => {
    const result = {
      batch_id: "batch-1",
      sent_count: 0,
      pending_count: 1,
      accepted_count: 1,
      failed_count: 0,
      blocked_count: 0,
    };

    expect(notificationConfirmHeadline(result)).toBe("1건 발송 접수");
    expect(notificationConfirmFeedback(result)).toBe("1건 발송 접수 · 1건 발송 대기");
  });

  test("대기 없는 즉시 발송만 완료로 표시한다", () => {
    const result = {
      batch_id: "batch-2",
      sent_count: 1,
      pending_count: 0,
      accepted_count: 1,
      failed_count: 0,
      blocked_count: 0,
    };

    expect(notificationConfirmHeadline(result)).toBe("1건 발송 완료");
    expect(notificationConfirmFeedback(result)).toBe("1건 발송 완료");
  });

  test("일부 실패·차단은 미발송을 명시하고 경고로 표시한다", () => {
    const result = {
      batch_id: "batch-3",
      sent_count: 1,
      pending_count: 1,
      accepted_count: 2,
      failed_count: 1,
      blocked_count: 1,
    };

    expect(getNotificationConfirmPresentation(result)).toEqual({
      tone: "warning",
      headline: "2건 발송 접수",
      feedback: "2건 발송 접수 · 1건 발송 대기 · 2건 미발송",
    });
  });

  test("접수된 건 없이 실패·차단만 있으면 성공으로 표시하지 않는다", () => {
    const result = {
      batch_id: "batch-4",
      sent_count: 0,
      pending_count: 0,
      accepted_count: 0,
      failed_count: 1,
      blocked_count: 1,
    };

    expect(getNotificationConfirmPresentation(result)).toEqual({
      tone: "error",
      headline: "2건 미발송",
      feedback: "2건 미발송 · 실패 1건 · 차단 1건",
    });
  });
});
