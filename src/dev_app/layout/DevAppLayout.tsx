// PATH: src/dev_app/layout/DevAppLayout.tsx
// Mobile-first fullscreen layout: full viewport, bottom nav, no sidebar.

import "./DevAppLayout.css";
import { Outlet, Link, useLocation } from "react-router-dom";

const NAV = [
  { to: "/dev/home", label: "Home", icon: "⌂" },
  { to: "/dev/branding", label: "Branding", icon: "◇" },
];

export default function DevAppLayout() {
  const location = useLocation();

  return (
    <div className="dev-app-root">
      <header className="dev-app-header">
        <span className="dev-app-title">Academy Dev</span>
        <Link
          to="/admin"
          className="dev-app-back"
          aria-label="Back to Admin"
        >
          Admin
        </Link>
      </header>

      <main className="dev-app-main">
        <Outlet />
      </main>

      <nav className="dev-app-bottom-nav" aria-label="Main navigation">
        {NAV.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            className={`dev-app-nav-item ${
              location.pathname === to ? "dev-app-nav-item--active" : ""
            }`}
            aria-current={location.pathname === to ? "page" : undefined}
          >
            <span className="dev-app-nav-icon" aria-hidden>{icon}</span>
            <span className="dev-app-nav-label">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
