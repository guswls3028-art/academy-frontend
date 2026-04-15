// PATH: src/app_teacher/shared/hooks/usePushSubscription.ts
// Web Push 구독 관리 훅
import { useState, useEffect, useCallback } from "react";
import api from "@/shared/api/axios";

interface PushState {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  loading: boolean;
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: "unsupported",
    subscribed: false,
    loading: true,
  });

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    if (!("PushManager" in window) || !("serviceWorker" in navigator)) {
      setState({ supported: false, permission: "unsupported", subscribed: false, loading: false });
      return;
    }

    const permission = Notification.permission;
    let subscribed = false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      subscribed = !!sub;
    } catch {
      // ignore
    }

    setState({ supported: true, permission, subscribed, loading: false });
  }

  const subscribe = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      // 1. VAPID 공개키 가져오기
      const keyRes = await api.get("/teacher-app/push/vapid-key/");
      const vapidPublicKey: string = keyRes.data.public_key;

      if (!vapidPublicKey) {
        throw new Error("VAPID public key not configured");
      }

      // 2. 알림 권한 요청
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((s) => ({ ...s, permission, loading: false }));
        return;
      }

      // 3. Push 구독
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // 4. 서버에 등록
      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");

      await api.post("/teacher-app/push/subscribe/", {
        endpoint: subscription.endpoint,
        p256dh_key: p256dh ? arrayBufferToBase64(p256dh) : "",
        auth_key: auth ? arrayBufferToBase64(auth) : "",
        user_agent: navigator.userAgent,
      });

      setState({ supported: true, permission: "granted", subscribed: true, loading: false });
    } catch (err) {
      console.error("Push subscribe failed:", err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post("/teacher-app/push/unsubscribe/", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState((s) => ({ ...s, subscribed: false, loading: false }));
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  return { ...state, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
