// PATH: src/admin_app/layout/AdminAppLayout.tsx
import { Outlet, Link, useLocation } from "react-router-dom";

const NAV = [
  { to: "/dev/home", label: "Home" },
  { to: "/dev/branding", label: "Tenant branding (logo / images)" },
];

export default function AdminAppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-56 bg-slate-800 text-white flex flex-col">
        <div className="p-4 border-b border-slate-600">
          <span className="font-semibold text-sm">Academy Dev Admin</span>
        </div>
        <nav className="p-2 flex flex-col gap-1">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-2 rounded text-sm ${
                location.pathname === to
                  ? "bg-slate-600 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-4 border-t border-slate-600">
          <Link
            to="/admin"
            className="text-xs text-slate-400 hover:text-white"
          >
            ← Back to Admin
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
