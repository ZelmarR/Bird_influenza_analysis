import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label,
} from "recharts";
import { fetchResults } from "../api";
import "../App.css";

const LOCATIONS = ["A", "B", "C"];

function fmt(val, decimals = 1) {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  return isNaN(n) ? "—" : n.toFixed(decimals);
}

function birdsPerHour(row) {
  if (!row?.birds_per_minute) return null;
  let arr;
  try { arr = JSON.parse(row.birds_per_minute); } catch { return null; }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const windowSize = 5;
  const windowAvgs = [];
  for (let i = 0; i < arr.length; i += windowSize) {
    const win = arr.slice(i, i + windowSize);
    windowAvgs.push(win.reduce((s, v) => s + (Number(v) || 0), 0) / win.length);
  }
  return Math.round((windowAvgs.reduce((s, v) => s + v, 0) / windowAvgs.length) * 12);
}

function StatCell({ label, value, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="stat-cell"
      onMouseEnter={() => hint && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div className="stat-cell-value">{value}</div>
      <div className="stat-cell-label">
        {label}
        {hint && <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>ⓘ</span>}
      </div>
      {show && hint && (
        <div style={{
          position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)",
          background: "var(--charcoal)", color: "#fff", borderRadius: 4,
          padding: "8px 12px", fontSize: 12, whiteSpace: "normal",
          width: 220, zIndex: 20, lineHeight: 1.5,
        }}>{hint}</div>
      )}
    </div>
  );
}

function TooltipTh({ children, tip }) {
  const [show, setShow] = useState(false);
  return (
    <th
      style={{ position: "relative", cursor: "default" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}{" "}
      <span style={{ color: "var(--text-muted)", fontSize: 10 }}>ⓘ</span>
      {show && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 10,
          background: "var(--charcoal)", color: "#fff", borderRadius: 4,
          padding: "8px 12px", fontSize: 12, whiteSpace: "normal",
          width: 220, fontWeight: 400, lineHeight: 1.5,
        }}>{tip}</div>
      )}
    </th>
  );
}

const CHART_MARGIN = { top: 12, right: 24, bottom: 64, left: 74 };

function RotatedXTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={8} textAnchor="end" fill="var(--text-muted)" fontSize={11} transform="rotate(-35)">
        {payload.value}
      </text>
    </g>
  );
}

function ChartSection({ title, description, children }) {
  return (
    <div className="chart-section">
      <div className="chart-title">{title}</div>
      {description && <p className="chart-desc">{description}</p>}
      {children}
    </div>
  );
}

function LocationTab({ location }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchResults(location);
      setRows(data);
    } catch {
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [location]);

  if (loading) return (
    <p style={{ color: "var(--text-muted)", padding: "12px 0", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
      Loading…
    </p>
  );
  if (error) return <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>;
  if (rows.length === 0) return (
    <div className="panel" style={{ textAlign: "center", padding: "48px 32px" }}>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: "var(--charcoal)", marginBottom: 10 }}>
        No results yet
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20, maxWidth: 380, margin: "0 auto 20px" }}>
        Location {location} has no processed videos. Upload a field recording on the Process page first.
      </p>
      <button className="btn btn-outline" onClick={load}>Refresh</button>
    </div>
  );

  const label = (r, i) => r.recorded_at || r.upload_date || `Video ${i + 1}`;

  const chartData = rows.map((r, i) => ({
    name: label(r, i),
    "Unique Birds": Number(r.unique_flying_birds) || 0,
    "Max Concurrent": Number(r.max_concurrent_birds) || 0,
    "Detection Latency (s)": r.first_detection_second != null && r.first_detection_second !== "" ? Number(r.first_detection_second) : null,
    "Track Noise Ratio": r.track_noise_ratio != null && r.track_noise_ratio !== "" ? Number(r.track_noise_ratio) : null,
    "Avg Motion (px/frame)": r.avg_motion_score != null && r.avg_motion_score !== "" ? Number(r.avg_motion_score) : null,
  }));

  const bphValues = rows.map(birdsPerHour).filter(v => v !== null);
  const avgBph = bphValues.length > 0
    ? Math.round(bphValues.reduce((s, v) => s + v, 0) / bphValues.length)
    : "—";

  const latencyRows = rows.filter(r => r.first_detection_second != null && r.first_detection_second !== "");
  const avgLatency = latencyRows.length > 0
    ? (latencyRows.reduce((s, r) => s + Number(r.first_detection_second), 0) / latencyRows.length).toFixed(1)
    : "—";

  const totalUnique = rows.reduce((s, r) => s + (Number(r.unique_flying_birds) || 0), 0);

  const bphData = rows
    .map((r, i) => { const bph = birdsPerHour(r); return bph !== null ? { name: label(r, i), "Birds / Hour": bph } : null; })
    .filter(Boolean);

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
          {rows.length} VIDEO{rows.length !== 1 ? "S" : ""} · LOCATION {location}
        </span>
        <button className="btn btn-outline" onClick={load} style={{ fontSize: 12, padding: "6px 14px" }}>
          Refresh
        </button>
      </div>

      {/* Summary stat strip */}
      <div className="stat-row" style={{ marginBottom: 24 }}>
        <StatCell
          label="Total Unique Birds"
          value={totalUnique}
          hint="Sum of all unique flying birds confirmed across every video at this location."
        />
        <StatCell
          label="Avg Birds / Hour"
          value={avgBph}
          hint="Average estimated bird activity rate across all videos, extrapolated to birds per hour."
        />
        <StatCell
          label="Avg Detection Latency"
          value={avgLatency === "—" ? "—" : `${avgLatency}s`}
          hint="Average time (seconds) into a video before the first confirmed flying bird appeared."
        />
      </div>

      {/* Results table */}
      <div className="panel" style={{ padding: 0, marginBottom: 24, overflowX: "auto" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-light)" }}>
          <div className="panel-label">Per-Video Results</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <TooltipTh tip="File name of the processed video">Video</TooltipTh>
                <TooltipTh tip="Date and time the video was recorded">Recorded</TooltipTh>
                <TooltipTh tip="Total individually tracked flying birds confirmed">Unique Birds</TooltipTh>
                <TooltipTh tip="Highest number of birds flying simultaneously in any frame">Max Concurrent</TooltipTh>
                <TooltipTh tip="Length of the video clip in seconds">Duration (s)</TooltipTh>
                <TooltipTh tip="Wall-clock time taken by the server to process this video">Processing (s)</TooltipTh>
                <TooltipTh tip="Seconds from video start until the first confirmed flying bird appeared">First Detection (s)</TooltipTh>
                <TooltipTh tip="Time (s) at which the maximum number of concurrent birds occurred">Peak Second</TooltipTh>
                <TooltipTh tip="Confirmed birds ÷ all detection candidates. Closer to 1.0 = fewer false positives">Noise Ratio</TooltipTh>
                <TooltipTh tip="Average pixel displacement per frame across detected bird regions (optical flow)">Avg Motion (px/fr)</TooltipTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.video_name}>
                    {r.video_name}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.recorded_at || r.upload_date || "—"}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: "var(--forest)" }}>{r.unique_flying_birds}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace" }}>{r.max_concurrent_birds}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(r.duration_seconds, 0)}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(r.processing_time, 0)}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(r.first_detection_second)}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(r.peak_concurrent_second)}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(r.track_noise_ratio, 3)}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(r.avg_motion_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart 1 */}
      <ChartSection
        title="Unique Flying Birds — Over Time"
        description="Total individually tracked birds confirmed per video session. An upward trend may indicate increasing bird activity at this location."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={11} fill="var(--text-muted)" />
            </XAxis>
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false}>
              <Label value="Count (birds)" angle={-90} position="insideLeft" offset={10} dy={55} fontSize={11} fill="var(--text-muted)" />
            </YAxis>
            <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="Unique Birds" stroke="var(--forest)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--forest)" }} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 2 */}
      <ChartSection
        title="Max Concurrent Birds in a Single Frame"
        description="Peak simultaneous bird count within any one frame of each video. Indicates flock density at its highest moment."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={11} fill="var(--text-muted)" />
            </XAxis>
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false}>
              <Label value="Count (birds)" angle={-90} position="insideLeft" offset={10} dy={55} fontSize={11} fill="var(--text-muted)" />
            </YAxis>
            <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="Max Concurrent" stroke="var(--sage)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--sage)" }} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 3 */}
      <ChartSection
        title="Estimated Birds Per Hour — Per Video"
        description="Extrapolated hourly rate: bird counts are averaged across 5-minute windows, then multiplied by 12. Useful for comparing activity intensity across sessions."
      >
        {bphData.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
            No per-minute data available yet. Process a video to populate this chart.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bphData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
                <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={11} fill="var(--text-muted)" />
              </XAxis>
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false}>
                <Label value="Birds per hour (est.)" angle={-90} position="insideLeft" offset={10} dy={70} fontSize={11} fill="var(--text-muted)" />
              </YAxis>
              <Tooltip formatter={(v) => [`${v} birds/hr`, "Estimated Rate"]} contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }} />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 12 }} />
              <Bar dataKey="Birds / Hour" fill="var(--forest)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartSection>

      {/* Chart 4 */}
      <ChartSection
        title="First Detection Latency — Over Time"
        description="How many seconds into each video the first confirmed flying bird appeared. Lower values mean birds appeared earlier in the recording."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.filter(d => d["Detection Latency (s)"] !== null)} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={11} fill="var(--text-muted)" />
            </XAxis>
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }}>
              <Label value="Time (seconds)" angle={-90} position="insideLeft" offset={10} dy={55} fontSize={11} fill="var(--text-muted)" />
            </YAxis>
            <Tooltip formatter={(v) => [`${v}s`, "First Detection At"]} contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="Detection Latency (s)" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: "#7c3aed" }} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 5 */}
      <ChartSection
        title="Track Noise Ratio — Over Time"
        description="Ratio of confirmed flying birds to total detection candidates (0 to 1). A higher ratio means fewer false positives — the algorithm is confidently identifying real birds."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.filter(d => d["Track Noise Ratio"] !== null)} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={11} fill="var(--text-muted)" />
            </XAxis>
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} domain={[0, 1]}>
              <Label value="Ratio (0 = noise, 1 = signal)" angle={-90} position="insideLeft" offset={10} dy={90} fontSize={11} fill="var(--text-muted)" />
            </YAxis>
            <Tooltip formatter={(v) => [v?.toFixed(3), "Noise Ratio"]} contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="Track Noise Ratio" stroke="#d97706" strokeWidth={2.5} dot={{ r: 4, fill: "#d97706" }} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 6 */}
      <ChartSection
        title="Average Motion Score — Over Time"
        description="Mean pixel displacement per frame across all detected bird regions (optical flow). Higher values indicate faster-moving birds or stronger wind conditions."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.filter(d => d["Avg Motion (px/frame)"] !== null)} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={11} fill="var(--text-muted)" />
            </XAxis>
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }}>
              <Label value="Pixels per frame (avg)" angle={-90} position="insideLeft" offset={10} dy={70} fontSize={11} fill="var(--text-muted)" />
            </YAxis>
            <Tooltip formatter={(v) => [`${v?.toFixed(2)} px/frame`, "Avg Motion"]} contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="Avg Motion (px/frame)" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 4, fill: "#e11d48" }} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>
    </div>
  );
}

export default function Analysis() {
  const [activeTab, setActiveTab] = useState("A");

  return (
    <div className="page">
      <div style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Observation data</div>
        <h1 className="page-title">Analysis</h1>
        <p className="page-subtitle">
          Review bird detection results per location. Hover column headers for metric explanations.
        </p>
      </div>

      <div className="tab-rail">
        {LOCATIONS.map((loc) => (
          <button
            key={loc}
            className={`tab-item${activeTab === loc ? " active" : ""}`}
            onClick={() => setActiveTab(loc)}
          >
            Location {loc}
          </button>
        ))}
      </div>

      <LocationTab key={activeTab} location={activeTab} />
    </div>
  );
}
