import { Link, useNavigate, useLocation } from "react-router-dom";
import { logout } from "../api";
import driveLogo from "../assets/vite.svg";

const LINKS = [
  { to: "/app/home",     label: "Overview" },
  { to: "/app/process",  label: "Process Recording" },
  { to: "/app/analysis", label: "Analysis" },
];

const QUESTIONS_URL = "https://www.drivelabresearch.com/contact-us";

export default function NavBar() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      <Link to="/app/home" className="navbar-brand">
        Wild Bird Activity <span> Monitor</span>
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

      <a
        href={QUESTIONS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="nav-link"
      >
        Questions
      </a>
      <a
        href="https://www.drivelabresearch.com/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}
      >
        <img src={driveLogo} alt="DRIVE Lab" style={{ height: 32, width: "auto" }} />
      </a>
    </nav>
  );
}
