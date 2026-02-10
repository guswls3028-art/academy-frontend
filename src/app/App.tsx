// PATH: src/app/App.tsx
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./router/AppRouter";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import QueryProvider from "./providers/QueryProvider";
import { ProgramProvider } from "@/shared/program";

export default function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <ProgramProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </ProgramProvider>
      </BrowserRouter>
    </QueryProvider>
  );
}
