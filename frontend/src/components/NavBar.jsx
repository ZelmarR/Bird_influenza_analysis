import { Link, useNavigate, useLocation } from "react-router-dom";
import { logout } from "../api";
import "../App.css";

export default function NavBar() {
  const navigate = useNavigate();
  const loc = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav style={{
      background: "#1e293b",
      color: "#fff",
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      gap: "32px",
      height: 56,
    }}>
      <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>
        Bird Counter
      </span>
      <Link
        to="/app/process"
        style={{
          color: loc.pathname === "/app/process" ? "#60a5fa" : "#cbd5e1",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Process Video
      </Link>
      <Link
        to="/app/analysis"
        style={{
          color: loc.pathname === "/app/analysis" ? "#60a5fa" : "#cbd5e1",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Analysis
      </Link>
      <button
        onClick={handleLogout}
        style={{
          marginLeft: "auto",
          background: "transparent",
          border: "1px solid #475569",
          color: "#94a3b8",
          borderRadius: 6,
          padding: "5px 14px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Log out
      </button>
    </nav>
  );
}
