// PATH: src/features/messages/routes.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import MessageLayout from "./layout/MessageLayout";
import MessageRegisterPage from "./pages/MessageRegisterPage";
import MessageTemplatesPage from "./pages/MessageTemplatesPage";
import MessageLinkPage from "./pages/MessageLinkPage";
import MessageLogPage from "./pages/MessageLogPage";
import MessageGuidePage from "./pages/MessageGuidePage";

export function MessageRoutes() {
  return (
    <Routes>
      <Route element={<MessageLayout />}>
        <Route index element={<Navigate to="templates" replace />} />
        <Route path="templates" element={<MessageTemplatesPage />} />
        <Route path="register" element={<MessageRegisterPage />} />
        <Route path="link" element={<MessageLinkPage />} />
        <Route path="log" element={<MessageLogPage />} />
        <Route path="guide" element={<MessageGuidePage />} />
      </Route>
    </Routes>
  );
}
