// PATH: src/app/App.tsx
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./router/AppRouter";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import QueryProvider from "./providers/QueryProvider";
import { ProgramProvider } from "@/shared/program";
import SubscriptionExpiredOverlay from "@/shared/ui/SubscriptionExpiredOverlay";

export default function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <ProgramProvider>
          <AuthProvider>
            <AppRouter />
            <SubscriptionExpiredOverlay />
          </AuthProvider>
        </ProgramProvider>
      </BrowserRouter>
    </QueryProvider>
  );
}
