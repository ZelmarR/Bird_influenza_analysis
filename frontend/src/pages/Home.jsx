import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div>
      {/* ── Hero strip with side video ── */}
      <div className="home-hero">
        <div className="home-hero-split">
          {/* Left: text */}
          <div className="home-hero-text">
            <div className="home-hero-eyebrow">MSU CVM · Drive Lab Research</div>
            <h1 className="home-hero-title">
              Field Research <em>Station</em>
            </h1>
            <p className="home-hero-sub" style={{ maxWidth: "100%" }}>
              Birds feeding on farm crops cause real, measurable losses. Flocks arrive in concentrated
              bursts — often at the same field locations and the same times of day — consuming or
              contaminating food stores before farmers can intervene. Deploying deterrents effectively
              requires knowing <em>where</em> birds are arriving, <em>how many</em>, and <em>when</em> the
              pressure is highest.
            </p>
            <p className="home-hero-sub" style={{ maxWidth: "100%", marginTop: 10, opacity: 0.75 }}>
              Place a camera at each vulnerable spot on your farm, record short clips regularly,
              and upload them here. The system counts birds automatically, measures peak activity
              times, and builds a growing record per location — giving you the evidence to position
              diversions where and when they will have the greatest effect.
            </p>
            <ul className="home-hero-bullets">
              <li>
                <span className="bullet-label">Bird Activity Index</span>
                <span className="bullet-desc">Standardized bird detections standardized per hour of video. Higher values indicate greater observed bird activity and can be compared across recordings, times, and locations.<br/> This tool was designed to measure relative bird activity patterns, not to estimate the exact number of birds present. Thus, the resulting values should be interpreted as an activity index rather than as a bird count.</span>
              </li>
              <li>
                <span className="bullet-label">Peak concurrent activity</span>
                <span className="bullet-desc">The maximum number of birds detected simultaneously within a single video frame, providing a measure of peak flock activity during the recording.</span>
              </li>
              <li>
                <span className="bullet-label">Time to first detection</span>
                <span className="bullet-desc">The time from the start of the recording until the first confirmed flying bird is detected. Shorter times indicate that bird activity was detected earlier in the recording.</span>
              </li>
              <li>
                <span className="bullet-label">Track noise ratio</span>
                <span className="bullet-desc">The proportion of motion candidates classified as confirmed flying birds. Higher values indicate a cleaner detection signal with fewer false-positive tracks.</span>
              </li>
              <li>
                <span className="bullet-label">Average motion score</span>
                <span className="bullet-desc">The average movement of detected bird regions between video frames. This provides additional information about the movement characteristics of detected activity.</span>
              </li>
            </ul>
          </div>

          {/* Right: demo video */}
          <div className="home-hero-video-wrap">
            <video
              className="home-hero-video"
              src="/demo.mov"
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="home-hero-video-label">Live detection preview</div>
          </div>
        </div>
      </div>

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
          <div className="steps">
          {[
            { n: "01", title: "Set up cameras at key locations", desc: "Place a camera with a clear view of the skyline at each location you want to monitor. Keep the camera position consistent across recordings so activity can be compared over time. Up to five locations can be monitored separately." },
            { n: "02", title: "Record and upload footage", desc: "Collect repeated video recordings from each location and upload them to the app. Enter the recording date and start time, create the location or choose from the locations you have added." },
            { n: "03", title: "Let the model run", desc: "The system automatically detects and tracks flying birds throughout each recording. These detections are standardized by video time to generate a Bird Activity Index for each recording and location."},
            { n: "04", title: "Explore activity patterns", desc: "Review summary plots to see how bird activity changes over time and across locations. As repeated recordings accumulate, you can identify baseline activity, recurring patterns, and periods of increased or decreased activity. The underlying detection data can also be downloaded for further analysis. " },
          ].map(({ n, title, desc }) => (
            <div key={n} className="step">
              <div className="step-num">{n}</div>
              <div className="step-title">{title}</div>
              <div className="step-desc">{desc}</div>
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* ── Research behind the tool ── */}
      <div style={{ borderTop: "1px solid var(--border-light)", padding: "32px 28px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              Research behind the tool
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, maxWidth: 580, lineHeight: 1.6 }}>
              This tool was developed as part of the research on automated bird activity monitoring for agricultural applications. The detection pipeline and activity metrics are described in detail in the associated paper.
            </p>
          </div>
          <a
            href="/paper.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "var(--sage-light)",
              color: "var(--charcoal)",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Learn more →
          </a>
        </div>
      </div>
    </div>
  );
}
