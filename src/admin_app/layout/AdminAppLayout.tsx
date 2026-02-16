// PATH: src/admin_app/layout/AdminAppLayout.tsx
// Mobile-first fullscreen layout: full viewport, bottom nav, no sidebar.

import { Outlet, Link, useLocation } from "react-router-dom";

const NAV = [
  { to: "/dev/home", label: "Home", icon: "⌂" },
  { to: "/dev/branding", label: "Branding", icon: "◇" },
];

export default function AdminAppLayout() {
  const location = useLocation();

  return (
    <div className="admin-app-root">
      <header className="admin-app-header">
        <span className="admin-app-title">Academy Dev Admin</span>
        <Link
          to="/admin"
          className="admin-app-back"
          aria-label="Back to Admin"
        >
          Admin
        </Link>
      </header>

      <main className="admin-app-main">
        <Outlet />
      </main>

      <nav className="admin-app-bottom-nav" aria-label="Main navigation">
        {NAV.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            className={`admin-app-nav-item ${
              location.pathname === to ? "admin-app-nav-item--active" : ""
            }`}
            aria-current={location.pathname === to ? "page" : undefined}
          >
            <span className="admin-app-nav-icon" aria-hidden>{icon}</span>
            <span className="admin-app-nav-label">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
