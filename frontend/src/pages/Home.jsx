import { useNavigate } from "react-router-dom";
import "../App.css";

const GALLERY = [
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8AIgtpQr1ngVvdFGZWJ0QwZpmoqx3ZBQJLPZjv6IoGRaZziUnmR3JlqkL&s=10",
    alt: "Bird flock in field",
    caption: "Field observation site",
  },
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkB58PJhdxMGHuH1tBjN3K9Q_naEqXtbnjFO58aNDjyUbGMkfX9Q1fiBNt&s=10",
    alt: "Birds in flight",
    caption: "Avian movement tracking",
  },
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSr8U5GZts14UueWRvE5SOxRsWQJLi1-QbF_W7Dtkmesw&s",
    alt: "Bird colony",
    caption: "Colony density monitoring",
  },
  {
    src: "https://media.licdn.com/dms/image/v2/C4E22AQGh3JeHpW1Sjg/feedshare-shrink_800/feedshare-shrink_800/0/1660321801209?e=2147483647&v=beta&t=kEY3HlgAVPYj0WHOFoUPa6VZwN1mMmXDn25CfoGd57Y",
    alt: "Research team fieldwork",
    caption: "Research fieldwork",
  },
  {
    src: "https://cvm.msu.edu/assets/images/hospital/_imageFit650/anesthesia.jpg",
    alt: "MSU CVM lab",
    caption: "MSU CVM laboratory",
  },
];

const QUICK_ACTIONS = [
  {
    to: "/app/process",
    icon: "▶",
    title: "Process a Video",
    desc: "Upload a field recording and run automated bird detection with live frame preview.",
    color: "#2563eb",
  },
  {
    to: "/app/analysis",
    icon: "📊",
    title: "View Analysis",
    desc: "Explore trends, bird counts over time, and detection metrics across all your sessions.",
    color: "#059669",
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page">
      {/* Welcome banner */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
        borderRadius: 14,
        padding: "36px 32px",
        marginBottom: 32,
        color: "#fff",
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>
          Welcome to Bird Counter
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 15, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
          An automated avian detection platform for field research. Upload videos to detect
          and count flying birds, then explore trends in the analysis dashboard.
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 20, marginBottom: 36, flexWrap: "wrap" }}>
        {QUICK_ACTIONS.map(({ to, icon, title, desc, color }) => (
          <div
            key={to}
            onClick={() => navigate(to)}
            className="card"
            style={{
              flex: "1 1 260px",
              cursor: "pointer",
              marginBottom: 0,
              borderTop: `4px solid ${color}`,
              transition: "box-shadow 0.2s, transform 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "";
              e.currentTarget.style.transform = "";
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1e293b", marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>{desc}</div>
            <div style={{ marginTop: 16, color: color, fontWeight: 600, fontSize: 14 }}>
              Get started →
            </div>
          </div>
        ))}
      </div>

      {/* Image gallery */}
      <div className="card">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
          Research Gallery
        </h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          Field sites, bird populations, and laboratory facilities monitored by this platform.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
        }}>
          {GALLERY.map(({ src, alt, caption }) => (
            <div
              key={src}
              style={{
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <img
                src={src}
                alt={alt}
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                onError={e => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextSibling.style.display = "flex";
                }}
              />
              <div style={{
                display: "none",
                height: 160,
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                fontSize: 13,
              }}>
                Image unavailable
              </div>
              <div style={{ padding: "10px 12px", fontSize: 13, color: "#374151", fontWeight: 500 }}>
                {caption}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
          How It Works
        </h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          Four steps from raw video to research-ready bird counts.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            { n: 1, title: "Select a location", desc: "Choose which camera location (A, B, or C) your video was recorded at." },
            { n: 2, title: "Enter recording date and time", desc: "Provide when the video was recorded — this becomes the X-axis label in your analysis charts." },
            { n: 3, title: "Upload and run detection", desc: "Select your video file, adjust the detection sensitivity if needed, then click Run Detection to start." },
            { n: 4, title: "Explore analysis", desc: "Go to Analysis to see per-video metrics and trends across all your sessions." },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{
                minWidth: 36, height: 36, borderRadius: "50%",
                background: "#2563eb", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 15, flexShrink: 0,
              }}>
                {n}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
