// PATH: src/app_admin/domains/messages/MessagesRoutes.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";

const MessageLayout = lazy(() => import("./MessageLayout"));
const MessageTemplatesPage = lazy(() => import("./pages/MessageTemplatesPage"));
const MessageAutoSendPage = lazy(() => import("./pages/MessageAutoSendPage"));
const MessageLogPage = lazy(() => import("./pages/MessageLogPage"));
const MessageSettingsPage = lazy(() => import("./pages/MessageSettingsPage"));

export function MessageRoutes() {
  return (
    <Routes>
      <Route element={renderLazyRoute(MessageLayout)}>
        <Route index element={<Navigate to="templates" replace />} />
        <Route path="templates" element={renderLazyRoute(MessageTemplatesPage)} />
        <Route path="auto-send" element={renderLazyRoute(MessageAutoSendPage)} />
        <Route path="log" element={renderLazyRoute(MessageLogPage)} />
        <Route path="settings" element={renderLazyRoute(MessageSettingsPage)} />
      </Route>
    </Routes>
  );
}
