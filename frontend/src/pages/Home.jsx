import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import heroImg from "../assets/hero.png";

const SLIDES = [
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8AIgtpQr1ngVvdFGZWJ0QwZpmoqx3ZBQJLPZjv6IoGRaZziUnmR3JlqkL&s=10",
    title: "Field Observation Site",
    sub: "Fixed-position cameras capture 30-minute recordings at each monitoring location",
  },
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkB58PJhdxMGHuH1tBjN3K9Q_naEqXtbnjFO58aNDjyUbGMkfX9Q1fiBNt&s=10",
    title: "Avian Movement Tracking",
    sub: "Optical flow captures directional coherence across consecutive frames",
  },
  {
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSr8U5GZts14UueWRvE5SOxRsWQJLi1-QbF_W7Dtkmesw&s",
    title: "Colony Density Study",
    sub: "Peak concurrent bird counts reveal population activity patterns",
  },
  {
    src: "https://media.licdn.com/dms/image/v2/C4E22AQGh3JeHpW1Sjg/feedshare-shrink_800/feedshare-shrink_800/0/1660321801209?e=2147483647&v=beta&t=kEY3HlgAVPYj0WHOFoUPa6VZwN1mMmXDn25CfoGd57Y",
    title: "Research Fieldwork",
    sub: "Multi-location data collection across MSU farm sites",
  },
  {
    src: "https://cvm.msu.edu/assets/images/hospital/_imageFit650/anesthesia.jpg",
    title: "MSU CVM Laboratory",
    sub: "Supporting avian influenza surveillance and biosurveillance research",
  },
];

function Carousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = SLIDES.length;
  const go = (i) => setIdx((i + n) % n);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % n), 4500);
    return () => clearInterval(t);
  }, [paused, n]);

  return (
    <div
      className="carousel-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map(({ src, title, sub }, i) => (
        <div key={i} className="carousel-slide" style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? "auto" : "none" }}>
          <img src={src} alt={title} onError={e => { e.currentTarget.style.opacity = 0; }} />
          <div className="carousel-slide-overlay" />
          <div className="carousel-caption" style={{
            opacity: i === idx ? 1 : 0,
            transform: i === idx ? "translateY(0)" : "translateY(10px)",
          }}>
            <div className="carousel-caption-title">{title}</div>
            <div className="carousel-caption-sub">{sub}</div>
          </div>
        </div>
      ))}

      {/* Arrows */}
      <button className="carousel-arrow prev" onClick={() => go(idx - 1)}>‹</button>
      <button className="carousel-arrow next" onClick={() => go(idx + 1)}>›</button>

      {/* Dots */}
      <div className="carousel-controls">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`carousel-dot${i === idx ? " active" : ""}`}
            style={{ width: i === idx ? 24 : 8 }}
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();

  return (
    <div>
      {/* ── Hero strip ── */}
      <div className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-eyebrow">MSU CVM · Avian Monitoring Platform</div>
          <h1 className="home-hero-title">
            Field Research <em>Station</em>
          </h1>
          <p className="home-hero-sub">
            Upload field recordings, run automated detection, and track bird populations
            across locations over time.
          </p>
        </div>
      </div>

      {/* ── Carousel ── */}
      <Carousel />

      {/* ── Action tiles ── */}
      <div className="action-rail">
        <div className="action-tile" onClick={() => navigate("/app/process")}>
          <div className="action-tile-label">Start here</div>
          <div className="action-tile-title">Process a Recording</div>
          <div className="action-tile-desc">
            Upload a field video, select a camera location, and run the detection
            pipeline. Watch annotated frames stream back in real time.
          </div>
          <div className="action-tile-arrow">Open recorder →</div>
        </div>

        <div className="action-tile" onClick={() => navigate("/app/analysis")}>
          <div className="action-tile-label">Your data</div>
          <div className="action-tile-title">Explore Analysis</div>
          <div className="action-tile-desc">
            Review per-video metrics, compare trends across sessions, and see
            estimated birds-per-hour rates for each monitoring location.
          </div>
          <div className="action-tile-arrow">View observations →</div>
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border-light)" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 28px 28px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>
            Detection workflow
          </div>
          <div className="workflow">
            {[
              { n: "Step 01", title: "Select location", desc: "Choose camera A, B, or C and enter the recording date and time." },
              { n: "Step 02", title: "Upload video", desc: "Drag in your .mp4, .avi, or .mov file. The file streams to the server in 1 MB chunks." },
              { n: "Step 03", title: "Live detection", desc: "Adaptive thresholding and optical flow run frame-by-frame. Watch confirmed birds appear in red boxes." },
              { n: "Step 04", title: "Results saved", desc: "Unique count, peak concurrency, and motion metrics are saved automatically to your account." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="workflow-step">
                <div className="workflow-step-n">{n}</div>
                <div className="workflow-step-title">{title}</div>
                <div className="workflow-step-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
