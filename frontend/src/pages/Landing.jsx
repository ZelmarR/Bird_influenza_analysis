import { Link } from "react-router-dom";
import heroImg from "../assets/hero.png";

export default function Landing() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#1e293b" }}>
      {/* Top nav */}
      <nav style={{
        background: "#1e293b",
        color: "#fff",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>Bird Counter</span>
        <div style={{ display: "flex", gap: 16 }}>
          <Link to="/login" style={{ color: "#cbd5e1", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            Log In
          </Link>
          <Link to="/login" style={{
            background: "#2563eb", color: "#fff", textDecoration: "none",
            padding: "6px 16px", borderRadius: 6, fontSize: 14, fontWeight: 600,
          }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
        color: "#fff",
        padding: "72px 32px",
        textAlign: "center",
      }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 20, letterSpacing: -1 }}>
          Automated Bird Detection
        </h1>
        <p style={{ fontSize: 20, color: "#94a3b8", maxWidth: 640, margin: "0 auto 36px", lineHeight: 1.6 }}>
          Bird Counter uses optical flow and multi-object tracking to automatically detect,
          count, and analyze flying birds in field video recordings — giving researchers
          fast, reproducible metrics without manual review.
        </p>
        <Link to="/login" style={{
          background: "#2563eb", color: "#fff", textDecoration: "none",
          padding: "14px 32px", borderRadius: 8, fontSize: 17, fontWeight: 700,
          display: "inline-block",
        }}>
          Get Started →
        </Link>
      </section>

      {/* Lab photos */}
      <section style={{ padding: "60px 32px", background: "#f8fafc" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>
          Our Lab
        </h2>
        <p style={{ textAlign: "center", color: "#64748b", marginBottom: 36 }}>
          Field cameras and research infrastructure used to collect bird activity data.
        </p>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", maxWidth: 960, margin: "0 auto" }}>
          <div style={{
            flex: "1 1 280px", maxWidth: 380, borderRadius: 12,
            overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            background: "#fff",
          }}>
            <img
              src={heroImg}
              alt="Research site"
              style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
            />
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Field Camera Setup</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Fixed-position cameras capture 30-minute recordings at each monitoring location.
              </div>
            </div>
          </div>

          <div style={{
            flex: "1 1 280px", maxWidth: 380, borderRadius: 12,
            overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            background: "#fff",
          }}>
            <div style={{
              width: "100%", height: 220, background: "linear-gradient(135deg, #0f172a, #1e3a5f)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 64 }}>🐦</span>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Detection Overlay</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Real-time bounding boxes mark candidate and confirmed flying birds frame by frame.
              </div>
            </div>
          </div>

          <div style={{
            flex: "1 1 280px", maxWidth: 380, borderRadius: 12,
            overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            background: "#fff",
          }}>
            <div style={{
              width: "100%", height: 220, background: "linear-gradient(135deg, #064e3b, #065f46)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 64 }}>📊</span>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Analytics Dashboard</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Trends across sessions: birds per hour, detection latency, motion scores, and more.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tutorial */}
      <section style={{ padding: "60px 32px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>
          How It Works
        </h2>
        <p style={{ textAlign: "center", color: "#64748b", marginBottom: 44 }}>
          Four steps from raw video to research-ready bird counts.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {[
            {
              step: 1,
              title: "Log in to your account",
              desc: "Create an account or sign in to access the detection tools and your saved results.",
            },
            {
              step: 2,
              title: "Upload your video",
              desc: "On the Process page, choose a camera location (A, B, or C), enter the date and time the video was recorded, then upload your .mp4, .avi, or .mov file.",
            },
            {
              step: 3,
              title: "Run detection and watch live",
              desc: "Click Run Detection to start. Bird candidates appear in yellow boxes; confirmed flying birds appear in red. A live progress bar tracks completion.",
            },
            {
              step: 4,
              title: "Explore analytics",
              desc: "Go to the Analysis page to review per-video metrics, compare trends over time, and see estimated birds-per-hour rates across all your sessions.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <div style={{
                minWidth: 44, height: 44, borderRadius: "50%",
                background: "#2563eb", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, flexShrink: 0,
              }}>
                {step}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{title}</div>
                <div style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <Link to="/login" style={{
            background: "#2563eb", color: "#fff", textDecoration: "none",
            padding: "14px 36px", borderRadius: 8, fontSize: 16, fontWeight: 700,
            display: "inline-block",
          }}>
            Start Analyzing →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: "#1e293b", color: "#64748b",
        textAlign: "center", padding: "24px 32px", fontSize: 13,
      }}>
        Bird Counter — Automated avian detection research tool
      </footer>
    </div>
  );
}
