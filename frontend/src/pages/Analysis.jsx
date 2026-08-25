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

function StatTile({ label, value, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{
        flex: "1 1 180px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "16px 20px",
        textAlign: "center",
        position: "relative",
        cursor: hint ? "default" : undefined,
      }}
      onMouseEnter={() => hint && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1e293b" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
        {label}{hint && <span style={{ color: "#94a3b8", marginLeft: 4 }}>ⓘ</span>}
      </div>
      {show && hint && (
        <div style={{
          position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)",
          background: "#1e293b", color: "#fff", borderRadius: 6,
          padding: "7px 11px", fontSize: 12, whiteSpace: "normal",
          width: 220, boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          lineHeight: 1.5, zIndex: 20,
        }}>{hint}</div>
      )}
    </div>
  );
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

function TooltipTh({ children, tip }) {
  const [show, setShow] = useState(false);
  return (
    <th
      style={{ position: "relative", cursor: "default" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}{" "}
      <span style={{ color: "#94a3b8", fontSize: 11 }}>ⓘ</span>
      {show && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 10,
          background: "#1e293b", color: "#fff", borderRadius: 6,
          padding: "7px 11px", fontSize: 12, whiteSpace: "normal",
          width: 220, boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          fontWeight: 400, lineHeight: 1.5,
        }}>{tip}</div>
      )}
    </th>
  );
}

const CHART_MARGIN = { top: 12, right: 24, bottom: 64, left: 74 };

function RotatedXTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={8} textAnchor="end" fill="#64748b" fontSize={11} transform="rotate(-35)">
        {payload.value}
      </text>
    </g>
  );
}

function ChartCard({ title, description, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>{description}</p>
      )}
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

  if (loading) return <p style={{ color: "#64748b", padding: "12px 0" }}>Loading…</p>;
  if (error) return <p className="error-msg">{error}</p>;
  if (rows.length === 0) return (
    <div>
      <p style={{ color: "#64748b", marginBottom: 16 }}>
        No results yet for Location {location}. Process a video first, then come back here.
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ color: "#374151", fontSize: 14, fontWeight: 600 }}>
          {rows.length} video{rows.length !== 1 ? "s" : ""} processed at this location
        </span>
        <button className="btn btn-outline" onClick={load} style={{ fontSize: 13, padding: "6px 14px" }}>
          Refresh
        </button>
      </div>

      {/* Summary tiles */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        <StatTile
          label="Total Unique Birds"
          value={totalUnique}
          hint="Sum of all unique flying birds confirmed across every video at this location."
        />
        <StatTile
          label="Avg Birds / Hour"
          value={avgBph}
          hint="Average estimated bird activity rate across all videos, extrapolated to birds per hour."
        />
        <StatTile
          label="Avg Detection Latency"
          value={avgLatency === "—" ? "—" : `${avgLatency}s`}
          hint="Average time (seconds) into a video before the first confirmed flying bird appeared."
        />
      </div>

      {/* Results table */}
      <div className="card" style={{ overflowX: "auto", padding: 0 }}>
        <div style={{ padding: "16px 20px 0", borderBottom: "1px solid #f1f5f9" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0, paddingBottom: 12 }}>
            Per-Video Results
          </h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <TooltipTh tip="File name of the processed video">Video</TooltipTh>
                <TooltipTh tip="Date and time the video was recorded (entered at upload time)">Recorded</TooltipTh>
                <TooltipTh tip="Total number of individually tracked flying birds confirmed in this video">Unique Birds</TooltipTh>
                <TooltipTh tip="Highest number of birds flying simultaneously in any single frame">Max Concurrent</TooltipTh>
                <TooltipTh tip="Length of the video clip in seconds">Duration (s)</TooltipTh>
                <TooltipTh tip="Wall-clock time taken by the server to fully process this video">Processing (s)</TooltipTh>
                <TooltipTh tip="Seconds from video start until the first confirmed flying bird appeared">First Detection (s)</TooltipTh>
                <TooltipTh tip="Time (seconds) at which the maximum number of concurrent birds occurred">Peak Second</TooltipTh>
                <TooltipTh tip="Confirmed birds ÷ all detection candidates. Closer to 1.0 = fewer false positives">Noise Ratio</TooltipTh>
                <TooltipTh tip="Average pixel displacement per frame across detected bird regions (optical flow). Higher = faster-moving birds">Avg Motion (px/fr)</TooltipTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.video_name}>
                    {r.video_name}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.recorded_at || r.upload_date || "—"}</td>
                  <td><strong style={{ color: "#1e293b" }}>{r.unique_flying_birds}</strong></td>
                  <td>{r.max_concurrent_birds}</td>
                  <td>{fmt(r.duration_seconds, 0)}</td>
                  <td>{fmt(r.processing_time, 0)}</td>
                  <td>{fmt(r.first_detection_second)}</td>
                  <td>{fmt(r.peak_concurrent_second)}</td>
                  <td>{fmt(r.track_noise_ratio, 3)}</td>
                  <td>{fmt(r.avg_motion_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart 1 */}
      <ChartCard
        title="Unique Flying Birds Detected — Over Time"
        description="Total individually tracked birds confirmed per video session. An upward trend may indicate increasing bird activity at this location."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={12} fill="#64748b" />
            </XAxis>
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false}>
              <Label value="Number of birds" angle={-90} position="insideLeft" offset={10} dy={60} fontSize={12} fill="#64748b" />
            </YAxis>
            <Tooltip formatter={(v, name) => [v, name]} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            <Line type="monotone" dataKey="Unique Birds" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 2 */}
      <ChartCard
        title="Max Concurrent Birds in a Single Frame — Over Time"
        description="Peak simultaneous bird count within any one frame of each video. Indicates flock density at its highest moment."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={12} fill="#64748b" />
            </XAxis>
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false}>
              <Label value="Number of birds" angle={-90} position="insideLeft" offset={10} dy={60} fontSize={12} fill="#64748b" />
            </YAxis>
            <Tooltip formatter={(v, name) => [v, name]} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            <Line type="monotone" dataKey="Max Concurrent" stroke="#0891b2" strokeWidth={2.5} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 3 */}
      <ChartCard
        title="Estimated Birds Per Hour — Per Video"
        description="Extrapolated hourly rate: bird counts are averaged across 5-minute windows, then multiplied by 12 to estimate birds per hour. Useful for comparing activity intensity across sessions."
      >
        {bphData.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>No per-minute data available yet. Process a video to populate this chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bphData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
                <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={12} fill="#64748b" />
              </XAxis>
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false}>
                <Label value="Birds per hour (est.)" angle={-90} position="insideLeft" offset={10} dy={70} fontSize={12} fill="#64748b" />
              </YAxis>
              <Tooltip formatter={(v) => [`${v} birds/hr`, "Estimated Rate"]} />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
              <Bar dataKey="Birds / Hour" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 4 */}
      <ChartCard
        title="First Detection Latency — Over Time"
        description="How many seconds into each video the first confirmed flying bird appeared. Lower values mean birds appeared earlier in the recording."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.filter(d => d["Detection Latency (s)"] !== null)} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={12} fill="#64748b" />
            </XAxis>
            <YAxis tick={{ fontSize: 11 }}>
              <Label value="Time (seconds)" angle={-90} position="insideLeft" offset={10} dy={55} fontSize={12} fill="#64748b" />
            </YAxis>
            <Tooltip formatter={(v) => [`${v}s`, "First Detection At"]} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            <Line type="monotone" dataKey="Detection Latency (s)" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 5 */}
      <ChartCard
        title="Track Noise Ratio — Over Time"
        description="Ratio of confirmed flying birds to total detection candidates (0 to 1). A higher ratio means fewer false positives — the algorithm is confidently identifying real birds."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.filter(d => d["Track Noise Ratio"] !== null)} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={12} fill="#64748b" />
            </XAxis>
            <YAxis tick={{ fontSize: 11 }} domain={[0, 1]}>
              <Label value="Ratio (0 = all noise, 1 = all signal)" angle={-90} position="insideLeft" offset={10} dy={100} fontSize={11} fill="#64748b" />
            </YAxis>
            <Tooltip formatter={(v) => [v?.toFixed(3), "Noise Ratio"]} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            <Line type="monotone" dataKey="Track Noise Ratio" stroke="#d97706" strokeWidth={2.5} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 6 */}
      <ChartCard
        title="Average Motion Score — Over Time"
        description="Mean pixel displacement per frame across all detected bird regions (measured via optical flow). Higher values indicate faster-moving birds or stronger wind conditions."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.filter(d => d["Avg Motion (px/frame)"] !== null)} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={12} fill="#64748b" />
            </XAxis>
            <YAxis tick={{ fontSize: 11 }}>
              <Label value="Pixels per frame (avg)" angle={-90} position="insideLeft" offset={10} dy={70} fontSize={12} fill="#64748b" />
            </YAxis>
            <Tooltip formatter={(v) => [`${v?.toFixed(2)} px/frame`, "Avg Motion"]} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            <Line type="monotone" dataKey="Avg Motion (px/frame)" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export default function Analysis() {
  const [activeTab, setActiveTab] = useState("A");

  return (
    <div className="page">
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, color: "#1e293b" }}>Analysis</h1>
      <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>
        Review bird detection results per location. Hover over column headers for metric explanations.
      </p>

      <div className="tab-bar">
        {LOCATIONS.map((loc) => (
          <button
            key={loc}
            className={`tab ${activeTab === loc ? "active" : ""}`}
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
