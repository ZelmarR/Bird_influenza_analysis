import { Link, useNavigate, useLocation } from "react-router-dom";
import { logout } from "../api";

const LINKS = [
  { to: "/app/home",     label: "Overview" },
  { to: "/app/process",  label: "Process Recording" },
  { to: "/app/analysis", label: "Analysis" },
];

export default function NavBar() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      <Link to="/app/home" className="navbar-brand">
        Bird<span> Counter</span>
      </Link>

      {LINKS.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={`nav-link${pathname === to ? " active" : ""}`}
        >
          {label}
        </Link>
      ))}

      <button className="nav-logout" onClick={() => { logout(); navigate("/login"); }}>
        Sign out
      </button>
    </nav>
  );
}
