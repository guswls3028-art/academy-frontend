import { useCallback, useEffect, useState } from "react";

import api from "@/shared/api/axios";

export interface PushSubscriptionState {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: PushSubscriptionState = {
  supported: false,
  permission: "unsupported",
  subscribed: false,
  loading: true,
  error: null,
};

interface UsePushSubscriptionOptions {
  endpointPrefix?: string;
}

export function usePushSubscription(
  options: UsePushSubscriptionOptions = {},
) {
  const endpointPrefix = options.endpointPrefix ?? "/teacher-app/push";
  const [state, setState] = useState<PushSubscriptionState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    if (
      typeof window === "undefined"
      || !("Notification" in window)
      || !("PushManager" in window)
      || !("serviceWorker" in navigator)
    ) {
      setState({
        supported: false,
        permission: "unsupported",
        subscribed: false,
        loading: false,
        error: null,
      });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && Notification.permission === "granted") {
        await registerSubscription(subscription, endpointPrefix);
      }
      setState({
        supported: true,
        permission: Notification.permission,
        subscribed: Boolean(subscription),
        loading: false,
        error: null,
      });
    } catch {
      setState({
        supported: true,
        permission: Notification.permission,
        subscribed: false,
        loading: false,
        error: "알림 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
  }, [endpointPrefix]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      // iOS는 사용자 제스처의 동기 호출 스택에서 권한 요청을 시작해야 한다.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((current) => ({
          ...current,
          permission,
          subscribed: false,
          loading: false,
          error: permission === "denied"
            ? "알림이 차단되었습니다. iPhone 설정에서 이 웹 앱의 알림을 허용해 주세요."
            : null,
        }));
        return false;
      }

      const keyResponse = await api.get<{ public_key: string }>(
        `${endpointPrefix}/vapid-key/`,
      );
      const vapidPublicKey = keyResponse.data.public_key;
      if (!vapidPublicKey) {
        throw new Error("VAPID key is not configured");
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      await registerSubscription(subscription, endpointPrefix);

      setState({
        supported: true,
        permission: "granted",
        subscribed: true,
        loading: false,
        error: null,
      });
      return true;
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "알림을 켜지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.",
      }));
      return false;
    }
  }, [endpointPrefix]);

  const unsubscribe = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.post(`${endpointPrefix}/unsubscribe/`, {
          endpoint: subscription.endpoint,
        });
        await subscription.unsubscribe();
      }
      setState((current) => ({
        ...current,
        subscribed: false,
        loading: false,
        error: null,
      }));
      return true;
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "알림을 끄지 못했습니다. 잠시 후 다시 시도해 주세요.",
      }));
      return false;
    }
  }, [endpointPrefix]);

  return { ...state, refresh, subscribe, unsubscribe };
}

async function registerSubscription(
  subscription: PushSubscription,
  endpointPrefix: string,
) {
  const p256dh = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");
  if (!p256dh || !auth) {
    throw new Error("Push encryption keys are unavailable");
  }
  await api.post(`${endpointPrefix}/subscribe/`, {
    endpoint: subscription.endpoint,
    p256dh_key: arrayBufferToBase64(p256dh),
    auth_key: arrayBufferToBase64(auth),
    user_agent: navigator.userAgent,
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}
