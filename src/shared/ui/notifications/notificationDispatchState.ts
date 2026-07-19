import type { NotificationConfirmResult } from "@/shared/api/contracts/notificationDispatch";

export type NotificationConfirmTicket = {
  id: number;
  previewId: number;
  token: string;
};

export type NotificationConfirmFinish = {
  released: boolean;
  needsFreshPreview: boolean;
};

export class NotificationRequestLifecycle {
  private previewId = 0;
  private confirmId = 0;
  private activeConfirm: NotificationConfirmTicket | null = null;

  startPreview(): number {
    this.previewId += 1;
    return this.previewId;
  }

  invalidatePreview(requestId: number): void {
    if (requestId !== this.previewId) return;
    this.previewId += 1;
  }

  isPreviewCurrent(requestId: number): boolean {
    return requestId === this.previewId;
  }

  hasConfirmInFlight(): boolean {
    return this.activeConfirm != null;
  }

  startConfirm(token: string): NotificationConfirmTicket | null {
    if (this.activeConfirm) return null;
    const ticket = {
      id: ++this.confirmId,
      previewId: this.previewId,
      token,
    };
    this.activeConfirm = ticket;
    return ticket;
  }

  isConfirmCurrent(ticket: NotificationConfirmTicket): boolean {
    return this.previewId === ticket.previewId
      && this.activeConfirm?.id === ticket.id
      && this.activeConfirm.token === ticket.token;
  }

  finishConfirm(ticket: NotificationConfirmTicket): NotificationConfirmFinish {
    if (this.activeConfirm?.id !== ticket.id || this.activeConfirm.token !== ticket.token) {
      return { released: false, needsFreshPreview: false };
    }
    const needsFreshPreview = this.previewId !== ticket.previewId;
    this.activeConfirm = null;
    return { released: true, needsFreshPreview };
  }
}

export type NotificationConfirmPresentation = {
  tone: "success" | "warning" | "error";
  headline: string;
  feedback: string;
};

export function getNotificationConfirmPresentation(
  result: NotificationConfirmResult,
): NotificationConfirmPresentation {
  const unacceptedCount = result.failed_count + result.blocked_count;

  if (result.pending_count > 0) {
    const headline = `${result.accepted_count}건 발송 접수`;
    return {
      tone: unacceptedCount > 0 ? "warning" : "success",
      headline,
      feedback: `${headline} · ${result.pending_count}건 발송 대기${
        unacceptedCount > 0 ? ` · ${unacceptedCount}건 미발송` : ""
      }`,
    };
  }

  if (result.sent_count > 0) {
    const headline = `${result.sent_count}건 발송 완료`;
    return {
      tone: unacceptedCount > 0 ? "warning" : "success",
      headline,
      feedback: `${headline}${unacceptedCount > 0 ? ` · ${unacceptedCount}건 미발송` : ""}`,
    };
  }

  if (unacceptedCount > 0) {
    const headline = `${unacceptedCount}건 미발송`;
    return {
      tone: "error",
      headline,
      feedback: `${headline} · 실패 ${result.failed_count}건 · 차단 ${result.blocked_count}건`,
    };
  }

  return {
    tone: "warning",
    headline: "발송된 알림이 없습니다",
    feedback: "발송된 알림이 없습니다",
  };
}

export function notificationConfirmHeadline(result: NotificationConfirmResult): string {
  return getNotificationConfirmPresentation(result).headline;
}

export function notificationConfirmFeedback(result: NotificationConfirmResult): string {
  return getNotificationConfirmPresentation(result).feedback;
}
