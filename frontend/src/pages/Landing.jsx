
import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import screenshot from "../assets/screenshot.png";

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
          <div className="hero-eyebrow">Agricultural bird damage — automated monitoring</div>
          <h1 className="hero-h1">
            Know when birds<br />
            hit the <em>farm.</em>
          </h1>
          <p className="hero-p">
            Birds cause significant crop losses on farms — flocking at feeding times,
            concentrating at specific field locations, and returning in predictable patterns.
            To deploy effective diversions, farmers and researchers first need hard numbers:
            how many birds, at which locations, and at what times of day.
            This system processes field camera recordings to deliver exactly that,
            automatically — no manual review required.
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
              ["Any location", "farmer-defined sites"],
              ["Time & count", "quantified activity"],
              ["Per-user", "isolated data"],
            ].map(([top, bot]) => (
              <div key={top} style={{ borderLeft: "2px solid var(--sage-mid)", paddingLeft: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--charcoal)" }}>{top}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{bot}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: screenshot */}
        <div className="hero-visual">
          <img src={screenshot} alt="Bird detection output" style={{ width: "100%", borderRadius: 8, display: "block" }} />
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
        <div className="section-eyebrow">The problem — and the solution</div>
        <h2 className="section-title">
          Quantify first.<br />Divert smarter.
        </h2>
        <p className="section-body">
          Bird damage to crops is a real and costly problem for farms. Flocks arrive
          at predictable times, concentrate at specific field locations, and can consume
          or contaminate large portions of a harvest before a farmer can respond.
          Conventional deterrents — noise cannons, reflective tape, netting — are only
          effective when deployed at the right place and the right time. Without data,
          farmers are guessing. This platform turns field camera footage into precise,
          per-location activity records: how many birds arrived, when during the day,
          and how that pattern shifts over the season. With that evidence in hand,
          diversionary measures can be targeted rather than scattered.
        </p>

        <div className="steps">
          {[
            { n: "01", title: "Set up cameras at key locations", desc: "Place a camera at each spot on the farm where bird activity is suspected — feed stores, open crop rows, water sources. Each location is tracked separately so you can compare activity levels across the farm." },
            { n: "02", title: "Record and upload footage", desc: "Capture a video clip at each location and upload it here. Enter the recording date and start time so activity can be plotted accurately on the timeline." },
            { n: "03", title: "Automated detection runs", desc: "The system uses optical flow and multi-object tracking to detect and count flying birds frame by frame — no manual tagging needed." },
            { n: "04", title: "Act on the data", desc: "Results show bird counts, peak arrival times, and activity trends per location. Use this to position diversions where and when they will have the greatest effect." },
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
          Ready to protect your farm?
        </div>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginBottom: 28 }}>
          Create an account, add your camera locations, and start turning field footage into actionable data.
        </p>
        <Link to="/login" className="cta-primary">
          Create an account →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        Bird Counter · MSU College of Veterinary Medicine · Agricultural bird damage research
      </footer>
    </div>
  );
}
