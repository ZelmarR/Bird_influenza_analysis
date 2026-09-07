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
            <div className="home-hero-eyebrow">MSU CVM · Wild bird monitoring system</div>
            <h1 className="home-hero-title">
              Field Research <em>Station</em>
            </h1>
            <p className="home-hero-sub" style={{ maxWidth: "100%" }}>
              Record videos periodically and process them to analyse bird activity patterns over time.
              <b style={{ display: "block", marginTop: 10, color: "rgba(255,255,255,0.55)", fontWeight: 500, fontSize: 12 }}>
                Note: This tool measures activity patterns — not an exact bird census.
              </b>
            </p>
            <ul className="home-hero-bullets">
              <li>
                <span className="bullet-label">Birds per unit time</span>
                <span className="bullet-desc">Estimated hourly bird activity rate, derived from per-minute counts averaged across 5-minute windows and extrapolated to an hour.</span>
              </li>
              <li>
                <span className="bullet-label">Max concurrent birds</span>
                <span className="bullet-desc">The highest number of birds observed simultaneously within a single video frame — a proxy for peak flock density at the site.</span>
              </li>
              <li>
                <span className="bullet-label">First detection latency</span>
                <span className="bullet-desc">Seconds from the start of the recording until the first confirmed flying bird appears. Shorter latency suggests active sites or well-placed cameras.</span>
              </li>
              <li>
                <span className="bullet-label">Track noise ratio</span>
                <span className="bullet-desc">Ratio of confirmed flying birds to total motion candidates (0 – 1). Values closer to 1.0 indicate a cleaner signal with fewer false positives from wind, foliage, or insects.</span>
              </li>
              <li>
                <span className="bullet-label">Average motion score</span>
                <span className="bullet-desc">Mean pixel displacement per frame across all detected bird regions via optical flow. Higher values reflect faster-moving birds or stronger environmental movement.</span>
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
          <div className="workflow workflow-5">
            {[
              {
                n: "Step 01",
                title: "Record the video",
                desc: "Position the camera at the fixed monitoring site. Record a continuous .mp4, .avi, or .mov clip — 10–30 minutes is ideal. Ensure the sky and bird flight path are clearly in frame and the camera is stable.",
              },
              {
                n: "Step 02",
                title: "Select location",
                desc: "On the Process page, choose which camera site you recorded at — Location A, B, or C — and enter the exact date and start time of the recording.",
              },
              {
                n: "Step 03",
                title: "Upload video",
                desc: "Drag your video file into the upload area or click to browse. The file is streamed to the server in 1 MB chunks so large files upload reliably on slow connections.",
              },
              {
                n: "Step 04",
                title: "Live detection",
                desc: "Adaptive thresholding and optical flow run frame-by-frame on the server. Annotated frames stream back in real time — confirmed flying birds appear highlighted in red bounding boxes.",
              },
              {
                n: "Step 05",
                title: "Results saved",
                desc: "Once processing completes, unique bird count, peak concurrency, first detection latency, noise ratio, and motion score are saved automatically to your account under the correct location.",
              },
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
