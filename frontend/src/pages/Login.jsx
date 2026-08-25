import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api";
import heroImg from "../assets/hero.png";

export default function Login() {
  const [mode, setMode]               = useState("login");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [name, setName]               = useState("");
  const [department, setDepartment]   = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "register") {
        await register(email, password, name, department);
        await login(email, password);
      } else {
        await login(email, password);
      }
      navigate("/app/home");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-root">

      {/* ── Visual side ── */}
      <div className="login-visual">
        <img src={heroImg} alt="Field site" />
        <div className="login-visual-overlay">
          <div className="login-visual-title">
            Automated avian<br />detection research.
          </div>
          <div className="login-visual-sub">
            Upload field recordings and instantly get bird counts, motion metrics,
            and longitudinal trend analysis — no manual review required.
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 28, flexWrap: "wrap" }}>
            {[["3", "Locations"], ["CV", "Engine"], ["GitHub", "Storage"]].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: "#fff" }}>{v}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form side ── */}
      <div className="login-form-side">
        <div className="login-form-inner">
          <div className="login-brand">Bird<em> Counter</em></div>
          <div className="login-tagline">MSU College of Veterinary Medicine</div>

          {/* Mode toggle */}
          <div className="mode-toggle">
            {["login", "register"].map(m => (
              <button
                key={m}
                className={`mode-btn${mode === m ? " active" : ""}`}
                onClick={() => { setMode(m); setError(""); }}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <div className="form-field">
                  <label>Full name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Jane Smith" />
                </div>
                <div className="form-field">
                  <label>Department</label>
                  <input type="text" required value={department} onChange={e => setDepartment(e.target.value)} placeholder="Pathobiology & Diagnostic Investigation" />
                </div>
              </>
            )}

            <div className="form-field">
              <label>Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@msu.edu" autoComplete="email" />
            </div>

            <div className="form-field">
              <label>Password</label>
              <div className="pw-wrapper">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div style={{ marginTop: 20, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
            By signing in you agree to use this platform solely for MSU CVM research purposes.
          </div>
        </div>
      </div>

    </div>
  );
}
