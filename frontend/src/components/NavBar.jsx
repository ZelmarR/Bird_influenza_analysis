import { useState } from "react";
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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  function handleNav(to) {
    setOpen(false);
    navigate(to);
  }

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/login");
  }

  return (
    <>
      <nav className="navbar">
        <Link to="/app/home" className="navbar-brand">
          Wild Bird Activity <span> Monitor</span>
        </Link>

        {/* Desktop links */}
        <div className="navbar-links">
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
          <button className="nav-logout" onClick={handleLogout}>
            Sign out
          </button>
        </div>

        {/* Hamburger — mobile only */}
        <button
          className="navbar-hamburger"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className={`hamburger-icon${open ? " open" : ""}`}>
            <span /><span /><span />
          </span>
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="mobile-nav-drawer" onClick={() => setOpen(false)}>
          <div className="mobile-nav-inner" onClick={e => e.stopPropagation()}>
            {LINKS.map(({ to, label }) => (
              <button
                key={to}
                className={`mobile-nav-link${pathname === to ? " active" : ""}`}
                onClick={() => handleNav(to)}
              >
                {label}
              </button>
            ))}
            <a
              href={QUESTIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-nav-link"
              onClick={() => setOpen(false)}
            >
              Questions
            </a>
            <a
              href="https://www.drivelabresearch.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-nav-link"
              onClick={() => setOpen(false)}
            >
              DRIVE Lab
            </a>
            <button className="mobile-nav-link mobile-nav-signout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
