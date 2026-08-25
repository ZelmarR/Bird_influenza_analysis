import { Link, useNavigate, useLocation } from "react-router-dom";
import { logout } from "../api";
import "../App.css";

const NAV_LINKS = [
  { to: "/app/home", label: "Home" },
  { to: "/app/process", label: "Process Video" },
  { to: "/app/analysis", label: "Analysis" },
];

export default function NavBar() {
  const navigate = useNavigate();
  const loc = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav style={{
      background: "#0f172a",
      color: "#fff",
      padding: "0 28px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      height: 58,
      borderBottom: "1px solid #1e293b",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <Link
        to="/app/home"
        style={{
          fontWeight: 800,
          fontSize: 17,
          letterSpacing: -0.5,
          color: "#fff",
          textDecoration: "none",
          marginRight: 16,
          whiteSpace: "nowrap",
        }}
      >
        Bird Counter
      </Link>

      {NAV_LINKS.map(({ to, label }) => {
        const active = loc.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            style={{
              color: active ? "#60a5fa" : "#94a3b8",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              padding: "4px 12px",
              borderRadius: 6,
              background: active ? "rgba(96,165,250,0.1)" : "transparent",
              transition: "color 0.15s, background 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </Link>
        );
      })}

      <button
        onClick={handleLogout}
        style={{
          marginLeft: "auto",
          background: "transparent",
          border: "1px solid #334155",
          color: "#94a3b8",
          borderRadius: 6,
          padding: "5px 16px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "border-color 0.15s, color 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        Log out
      </button>
    </nav>
  );
}
