import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import heroImg from "../assets/hero.png";

/* Simulated detections shown on the camera-frame mock */
const DETECTIONS = [
  { id: "B-04", x: "22%",  y: "28%", w: "11%", h: "14%", conf: 0.91, color: "#ef4444", trail: [{x:"20%",y:"32%"},{x:"19%",y:"31%"},{x:"21%",y:"29%"}] },
  { id: "B-07", x: "54%",  y: "18%", w: "9%",  h: "11%", conf: 0.87, color: "#ef4444", trail: [{x:"50%",y:"22%"},{x:"52%",y:"20%"},{x:"53%",y:"18%"}] },
  { id: "C-02", x: "70%",  y: "42%", w: "8%",  h: "10%", conf: 0.63, color: "#facc15", trail: [] },
  { id: "B-11", x: "38%",  y: "55%", w: "10%", h: "13%", conf: 0.79, color: "#ef4444", trail: [{x:"35%",y:"58%"},{x:"36%",y:"56%"}] },
];

function CameraFrame() {
  const [frame, setFrame] = useState(0);
  const [ts, setTs]       = useState("08:14:32");

  useEffect(() => {
    const iv = setInterval(() => {
      setFrame(f => f + 1);
      setTs(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="cam-frame">
      <img src={heroImg} alt="Field camera feed" />

      {/* Scanline sweep */}
      <div className="cam-scanline" />

      {/* Motion trails */}
      {DETECTIONS.map(det => det.trail.map((pt, i) => (
        <div key={`${det.id}-t${i}`} className="cam-trail" style={{
          left: pt.x, top: pt.y,
          width: 5 - i, height: 5 - i,
          background: det.color,
          opacity: 0.3 - i * 0.06,
        }} />
      )))}

      {/* Bounding boxes */}
      {DETECTIONS.map(det => (
        <div key={det.id} className="cam-bbox" style={{
          left: det.x, top: det.y, width: det.w, height: det.h,
          borderColor: det.color,
        }}>
          <div className="cam-bbox-label" style={{ background: det.color, color: "#fff" }}>
            {det.id} · {(det.conf * 100).toFixed(0)}%
          </div>
        </div>
      ))}

      {/* HUD top */}
      <div className="cam-hud-top">
        <span className="cam-badge cam-badge-rec">REC</span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className="cam-badge cam-badge-info">LOC A · FRAME {(frame % 9000) + 1200}</span>
          <span className="cam-badge cam-badge-info">{ts}</span>
        </div>
      </div>

      {/* HUD bottom */}
      <div className="cam-hud-bottom">
        <span className="cam-badge cam-badge-info">
          {DETECTIONS.filter(d => d.color === "#ef4444").length} CONFIRMED · {DETECTIONS.filter(d => d.color === "#facc15").length} CANDIDATE
        </span>
        <span className="cam-badge cam-badge-info" style={{ color: "#86efac" }}>
          ▶ LIVE ANALYSIS
        </span>
      </div>
    </div>
  );
}

const GALLERY_ITEMS = [
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8AIgtpQr1ngVvdFGZWJ0QwZpmoqx3ZBQJLPZjv6IoGRaZziUnmR3JlqkL&s=10",
    caption: "Field Observation Site",
  },
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkB58PJhdxMGHuH1tBjN3K9Q_naEqXtbnjFO58aNDjyUbGMkfX9Q1fiBNt&s=10",
    caption: "Flock Movement Study",
  },
  {
    src: "https://cvm.msu.edu/assets/images/hospital/_imageFit650/anesthesia.jpg",
    caption: "MSU CVM Laboratory",
  },
];

export default function Landing() {
  const navRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      if (!navRef.current) return;
      navRef.current.classList.toggle("scrolled", window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-root">

      {/* ── Navigation ── */}
      <nav ref={navRef} className="landing-nav">
        <span className="landing-brand">Bird<em> Counter</em></span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link to="/login" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", fontWeight: 500 }}>
            Sign in
          </Link>
          <Link to="/login" className="cta-primary" style={{ padding: "9px 18px", fontSize: 13 }}>
            Get access
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        {/* Left: copy */}
        <div style={{ animation: "fadeUp 0.7s ease both" }}>
          <div className="hero-eyebrow">Avian Monitoring · Computer Vision</div>
          <h1 className="hero-h1">
            See what the<br />
            field camera <em>sees.</em>
          </h1>
          <p className="hero-p">
            Automatically detect, count, and track flying birds across field recordings
            using optical flow and multi-object tracking — giving researchers fast,
            reproducible metrics without manual review.
          </p>
          <div className="hero-ctas">
            <Link to="/login" className="cta-primary">
              Process a recording
              <span style={{ fontSize: 16 }}>→</span>
            </Link>
            <Link to="/login" className="cta-secondary">
              Explore observations
            </Link>
          </div>

          {/* Tiny proof points */}
          <div style={{ display: "flex", gap: 24, marginTop: 36, flexWrap: "wrap" }}>
            {[
              ["Optical flow", "motion detection"],
              ["Multi-object", "tracking"],
              ["Per-user", "data isolation"],
            ].map(([top, bot]) => (
              <div key={top} style={{ borderLeft: "2px solid var(--sage-mid)", paddingLeft: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--charcoal)" }}>{top}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{bot}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: camera frame */}
        <div className="hero-visual">
          <CameraFrame />
          {/* Corner decoration */}
          <div style={{
            position: "absolute", bottom: -14, right: -14,
            width: 100, height: 100,
            border: "1px solid var(--sage-mid)",
            borderRadius: 4, zIndex: -1, opacity: 0.4,
          }} />
        </div>
      </section>

      {/* ── Gallery ── */}
      <section style={{ background: "var(--charcoal)", padding: "0" }}>
        <div className="gallery-strip">
          {GALLERY_ITEMS.map(({ src, caption }) => (
            <div key={caption} className="gallery-item">
              <img src={src} alt={caption}
                onError={e => { e.currentTarget.style.opacity = 0; }}
              />
              <div className="gallery-item-cap">{caption}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Method ── */}
      <section className="landing-section">
        <div className="section-eyebrow">Detection pipeline</div>
        <h2 className="section-title">
          Observe. Detect.<br />Understand.
        </h2>
        <p className="section-body">
          Each recording passes through a classical computer vision pipeline optimised
          for field conditions — variable lighting, fast-moving subjects, and cluttered
          sky backgrounds.
        </p>

        <div className="steps">
          {[
            { n: "01", title: "Upload recording", desc: "Select the camera location and upload your .mp4, .avi, or .mov file. Date and time metadata are recorded for longitudinal analysis." },
            { n: "02", title: "Adaptive threshold", desc: "Gaussian adaptive thresholding separates birds from sky regardless of overcast or bright conditions." },
            { n: "03", title: "Optical flow tracking", desc: "Farneback optical flow computes per-pixel motion vectors. Birds are confirmed by directional coherence across frames." },
            { n: "04", title: "Metrics & storage", desc: "Results — unique birds, peak concurrency, motion scores — are saved per user and location for longitudinal trend analysis." },
          ].map(({ n, title, desc }) => (
            <div key={n} className="step">
              <div className="step-num">{n}</div>
              <div className="step-title">{title}</div>
              <div className="step-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA band ── */}
      <section style={{
        background: "var(--forest-deep)",
        padding: "64px 40px",
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 30,
          color: "#fff",
          marginBottom: 14,
          letterSpacing: -0.5,
        }}>
          Ready to analyse your recordings?
        </div>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginBottom: 28 }}>
          Request access and start processing field videos in minutes.
        </p>
        <Link to="/login" className="cta-primary">
          Create an account →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        Bird Counter · MSU College of Veterinary Medicine · Avian influenza surveillance research
      </footer>
    </div>
  );
}
