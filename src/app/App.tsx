// PATH: src/app/App.tsx
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./router/AppRouter";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import QueryProvider from "./providers/QueryProvider";
import { ProgramProvider } from "@/shared/program";
import { ConfirmProvider } from "@/shared/ui/confirm";
import SubscriptionExpiredOverlay from "@/shared/ui/SubscriptionExpiredOverlay";
import VersionChecker from "@/shared/ui/layout/VersionChecker";
import ErrorBoundary from "@/shared/ui/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <BrowserRouter>
          <ConfirmProvider>
            <ProgramProvider>
              <AuthProvider>
                <VersionChecker />
                <AppRouter />
                <SubscriptionExpiredOverlay />
              </AuthProvider>
            </ProgramProvider>
          </ConfirmProvider>
        </BrowserRouter>
      </QueryProvider>
    </ErrorBoundary>
  );
}
