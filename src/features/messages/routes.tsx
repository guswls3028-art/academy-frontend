// PATH: src/features/messages/routes.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import MessageLayout from "./layout/MessageLayout";
import MessageTemplatesPage from "./pages/MessageTemplatesPage";
import MessageSendPage from "./pages/MessageSendPage";
import MessageAutoSendPage from "./pages/MessageAutoSendPage";
import MessageLogPage from "./pages/MessageLogPage";
import MessageSettingsPage from "./pages/MessageSettingsPage";

export function MessageRoutes() {
  return (
    <Routes>
      <Route element={<MessageLayout />}>
        <Route index element={<Navigate to="templates" replace />} />
        <Route path="templates" element={<MessageTemplatesPage />} />
        <Route path="send" element={<MessageSendPage />} />
        <Route path="auto-send" element={<MessageAutoSendPage />} />
        <Route path="log" element={<MessageLogPage />} />
        <Route path="settings" element={<MessageSettingsPage />} />
      </Route>
    </Routes>
  );
}
