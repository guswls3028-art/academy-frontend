import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import PageContainer from "./PageContainer";

export default function DefaultLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />
        <PageContainer>
          <Outlet />
        </PageContainer>
      </div>
    </div>
  );
}
