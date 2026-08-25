import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import "../App.css";

const GALLERY = [
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8AIgtpQr1ngVvdFGZWJ0QwZpmoqx3ZBQJLPZjv6IoGRaZziUnmR3JlqkL&s=10",
    alt: "Bird flock in field",
    caption: "Field Observation Site",
    sub: "Fixed-position cameras at each monitoring location",
  },
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkB58PJhdxMGHuH1tBjN3K9Q_naEqXtbnjFO58aNDjyUbGMkfX9Q1fiBNt&s=10",
    alt: "Birds in flight",
    caption: "Avian Movement Tracking",
    sub: "Optical flow captures fast-moving bird trajectories",
  },
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSr8U5GZts14UueWRvE5SOxRsWQJLi1-QbF_W7Dtkmesw&s",
    alt: "Bird colony",
    caption: "Colony Density Monitoring",
    sub: "Count concurrent birds at peak activity moments",
  },
  {
    src: "https://media.licdn.com/dms/image/v2/C4E22AQGh3JeHpW1Sjg/feedshare-shrink_800/feedshare-shrink_800/0/1660321801209?e=2147483647&v=beta&t=kEY3HlgAVPYj0WHOFoUPa6VZwN1mMmXDn25CfoGd57Y",
    alt: "Research team fieldwork",
    caption: "Research Fieldwork",
    sub: "Multi-location data collection across farm sites",
  },
  {
    src: "https://cvm.msu.edu/assets/images/hospital/_imageFit650/anesthesia.jpg",
    alt: "MSU CVM lab",
    caption: "MSU CVM Laboratory",
    sub: "Supporting avian influenza surveillance research",
  },
];

const STATS = [
  { value: "3", label: "Monitoring Locations" },
  { value: "CV", label: "Computer Vision Engine" },
  { value: "Real-time", label: "Live Detection Stream" },
  { value: "Auto", label: "GitHub Data Storage" },
];

const QUICK_ACTIONS = [
  {
    to: "/app/process",
    icon: "▶",
    title: "Process a Video",
    desc: "Upload a field recording and run automated bird detection with a live annotated frame preview.",
    color: "#2563eb",
    bg: "linear-gradient(135deg, #eff6ff, #dbeafe)",
  },
  {
    to: "/app/analysis",
    icon: "📊",
    title: "View Analysis",
    desc: "Explore bird count trends, detection latency, motion scores, and per-session metrics.",
    color: "#059669",
    bg: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
  },
];

function Carousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const go = (idx) => setActive((idx + GALLERY.length) % GALLERY.length);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => setActive(a => (a + 1) % GALLERY.length), 4000);
    return () => clearInterval(timerRef.current);
  }, [paused]);

  return (
    <div
      style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#0f172a", userSelect: "none" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      <div style={{ position: "relative", height: 420 }}>
        {GALLERY.map(({ src, alt, caption, sub }, i) => (
          <div
            key={i}
            style={{
              position: "absolute", inset: 0,
              opacity: i === active ? 1 : 0,
              transition: "opacity 0.8s ease",
              pointerEvents: i === active ? "auto" : "none",
            }}
          >
            <img
              src={src}
              alt={alt}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={e => { e.currentTarget.style.opacity = 0; }}
            />
            {/* Gradient overlay */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
            }} />
            {/* Caption */}
            <div style={{
              position: "absolute", bottom: 56, left: 28, right: 80,
              color: "#fff",
              transform: i === active ? "translateY(0)" : "translateY(12px)",
              opacity: i === active ? 1 : 0,
              transition: "transform 0.6s ease 0.2s, opacity 0.6s ease 0.2s",
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{caption}</div>
              <div style={{ fontSize: 13, color: "#cbd5e1" }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div style={{
        position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 8,
      }}>
        {GALLERY.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            style={{
              width: i === active ? 24 : 8, height: 8,
              borderRadius: 999, border: "none",
              background: i === active ? "#fff" : "rgba(255,255,255,0.4)",
              cursor: "pointer", padding: 0,
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Prev / Next arrows */}
      {[{ dir: -1, label: "‹", side: "left" }, { dir: 1, label: "›", side: "right" }].map(({ dir, label, side }) => (
        <button
          key={side}
          onClick={() => go(active + dir)}
          aria-label={dir === -1 ? "Previous" : "Next"}
          style={{
            position: "absolute", top: "50%", [side]: 14, transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.25)",
            color: "#fff", borderRadius: "50%",
            width: 38, height: 38, fontSize: 20, lineHeight: 1,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
        >
          {label}
        </button>
      ))}

      {/* Pause indicator */}
      {paused && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          background: "rgba(0,0,0,0.5)", color: "#fff",
          borderRadius: 6, padding: "3px 8px", fontSize: 11,
        }}>
          ⏸ Paused
        </div>
      )}
    </div>
  );
}

function CountUp({ target }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const num = parseInt(target);
    if (isNaN(num)) return;
    let start = 0;
    const step = Math.ceil(num / 30);
    const timer = setInterval(() => {
      start += step;
      if (start >= num) { setVal(num); clearInterval(timer); }
      else setVal(start);
    }, 40);
    return () => clearInterval(timer);
  }, [target]);

  const num = parseInt(target);
  return <span ref={ref}>{isNaN(num) ? target : val}</span>;
}

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page">

      {/* Hero banner */}
      <div className="hero-banner">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#60a5fa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            MSU CVM · Avian Research
          </div>
          <h1 className="hero-title">Bird Counter</h1>
          <p style={{ color: "#94a3b8", fontSize: 15, maxWidth: 500, lineHeight: 1.7, margin: "0 0 28px" }}>
            Automated avian detection powered by optical flow and multi-object tracking.
            Upload field videos, get instant bird counts, explore trends over time.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-hero-primary" onClick={() => navigate("/app/process")}>
              ▶ Process a Video
            </button>
            <button className="btn btn-hero-outline" onClick={() => navigate("/app/analysis")}>
              View Analysis →
            </button>
          </div>
        </div>
        {/* Animated birds decoration */}
        <div className="hero-birds" aria-hidden="true">
          {["🐦","🐦","🐦","🐦","🐦"].map((b, i) => (
            <span key={i} className={`bird bird-${i}`}>{b}</span>
          ))}
        </div>
      </div>

      {/* Stat bar */}
      <div className="stat-bar">
        {STATS.map(({ value, label }) => (
          <div key={label} className="stat-item">
            <div className="stat-value"><CountUp target={value} /></div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 20, marginBottom: 32, flexWrap: "wrap" }}>
        {QUICK_ACTIONS.map(({ to, icon, title, desc, color, bg }) => (
          <div
            key={to}
            onClick={() => navigate(to)}
            className="action-card"
            style={{ "--action-color": color, "--action-bg": bg }}
          >
            <div className="action-icon">{icon}</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1e293b", marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, flexGrow: 1 }}>{desc}</div>
            <div style={{ marginTop: 16, color, fontWeight: 700, fontSize: 14 }}>Get started →</div>
          </div>
        ))}
      </div>

      {/* Carousel */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>Research Gallery</h2>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 0 }}>
            Field sites and bird populations monitored by this platform. Hover to pause.
          </p>
        </div>
        <Carousel />
      </div>

      {/* How it works */}
      <div className="card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>How It Works</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Four steps from raw video to research-ready bird counts.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { n: 1, title: "Select a camera location", desc: "Choose Location A, B, or C — corresponding to the field camera that captured your video.", color: "#2563eb" },
            { n: 2, title: "Enter recording date and time", desc: "Tell the system when the video was recorded. This timestamp becomes the X-axis label in your analysis charts.", color: "#0891b2" },
            { n: 3, title: "Upload your video and run detection", desc: "Select a .mp4, .avi, or .mov file. Adjust detection sensitivity if needed, then click Run Detection to see annotated frames live.", color: "#7c3aed" },
            { n: 4, title: "Explore your results in Analysis", desc: "Head to the Analysis page to see per-video metrics, trend charts, and estimated birds-per-hour across all sessions.", color: "#059669" },
          ].map(({ n, title, desc, color }, idx, arr) => (
            <div key={n} style={{ display: "flex", gap: 16, alignItems: "flex-start", paddingBottom: idx < arr.length - 1 ? 24 : 0, position: "relative" }}>
              {/* Vertical line connector */}
              {idx < arr.length - 1 && (
                <div style={{
                  position: "absolute", left: 17, top: 36, bottom: 0, width: 2,
                  background: "linear-gradient(to bottom, #e2e8f0, transparent)",
                }} />
              )}
              <div style={{
                minWidth: 36, height: 36, borderRadius: "50%",
                background: color, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 15, flexShrink: 0, zIndex: 1,
                boxShadow: `0 0 0 4px ${color}22`,
              }}>
                {n}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
