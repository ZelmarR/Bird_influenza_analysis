import { useEffect, useState, useContext } from "react";
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label,
} from "recharts";
import sampleBph from "../assets/sample-bph.png";
import sampleMaxConcurrent from "../assets/sample-max-concurrent.png";
import sampleUniqueBirds from "../assets/sample-unique-birds.png";
import { fetchResults } from "../api";
import { LocationsContext } from "../App";
import "../App.css";

// ── Shared helpers ────────────────────────────────────────────────────────────

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

function bucketize(birdsPerMinuteJson) {
  if (!birdsPerMinuteJson) return [];
  let arr;
  try { arr = JSON.parse(birdsPerMinuteJson); } catch { return []; }
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const buckets = [];
  for (let i = 0; i < arr.length; i += 5) {
    const win = arr.slice(i, i + 5);
    buckets.push(win.reduce((s, v) => s + (Number(v) || 0), 0));
  }
  return buckets;
}

function toCumulative(buckets) {
  let running = 0;
  return buckets.map(v => (running += v));
}

// ── Overall Analysis sub-components ──────────────────────────────────────────

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

const CHART_MARGIN_OVERALL = { top: 12, right: 24, bottom: 64, left: 74 };

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

  const label = (r, i) => {
    if (r.recorded_at) return r.recorded_at;
    if (r.upload_date) return `${r.upload_date} (uploaded)`;
    return `Video ${i + 1}`;
  };

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
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
          {rows.length} VIDEO{rows.length !== 1 ? "S" : ""} · LOCATION {location}
        </span>
        <button className="btn btn-outline" onClick={load} style={{ fontSize: 12, padding: "6px 14px" }}>
          Refresh
        </button>
      </div>

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
                  <td style={{ whiteSpace: "nowrap" }}>{r.recorded_at || `${r.upload_date} (uploaded)` || "—"}</td>
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

      <ChartSection
        title="Unique Flying Birds — Over Time"
        description="Total individually tracked birds confirmed per video session. An upward trend may indicate increasing bird activity at this location."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={CHART_MARGIN_OVERALL}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={11} fill="var(--text-muted)" />
            </XAxis>
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false}>
              <Label value="Unique bird tracks" angle={-90} position="insideLeft" offset={10} dy={55} fontSize={11} fill="var(--text-muted)" />
            </YAxis>
            <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="Unique Birds" stroke="var(--forest)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--forest)" }} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      <ChartSection
        title="Max Concurrent Birds in a Single Frame"
        description="Peak simultaneous bird count within any one frame of each video. Indicates flock density at its highest moment."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={CHART_MARGIN_OVERALL}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
              <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={11} fill="var(--text-muted)" />
            </XAxis>
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false}>
              <Label value="Peak concurrent bird detections" angle={-90} position="insideLeft" offset={10} dy={55} fontSize={11} fill="var(--text-muted)" />
            </YAxis>
            <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="Max Concurrent" stroke="var(--sage)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--sage)" }} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      <ChartSection
        title="Bird activity index per hour"
        description="Extrapolated hourly rate: bird counts are averaged across 5-minute windows, then multiplied by 12. Useful for comparing activity intensity across sessions."
      >
        {bphData.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
            No per-minute data available yet. Process a video to populate this chart.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={bphData} margin={CHART_MARGIN_OVERALL}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="name" tick={<RotatedXTick />} interval={0}>
                <Label value="Recording Date / Time" position="insideBottom" offset={-50} fontSize={11} fill="var(--text-muted)" />
              </XAxis>
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false}>
                <Label value="Bird Activity Index (detections/hour)" angle={-90} position="insideLeft" offset={10} dy={70} fontSize={11} fill="var(--text-muted)" />
              </YAxis>
              <Tooltip formatter={(v) => [`${v} birds/hr`, "Estimated Rate"]} contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }} />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="Birds / Hour" stroke="var(--forest)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--forest)" }} activeDot={{ r: 6 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartSection>

      <ChartSection
        title="First Detection Latency — Over Time"
        description="How many seconds into each video the first confirmed flying bird appeared. Lower values mean birds appeared earlier in the recording."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.filter(d => d["Detection Latency (s)"] !== null)} margin={CHART_MARGIN_OVERALL}>
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

      <ChartSection
        title="Track Noise Ratio — Over Time"
        description="Ratio of confirmed flying birds to total detection candidates (0 to 1). A higher ratio means fewer false positives — the algorithm is confidently identifying real birds."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.filter(d => d["Track Noise Ratio"] !== null)} margin={CHART_MARGIN_OVERALL}>
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

      <ChartSection
        title="Average Motion Score — Over Time"
        description="Mean pixel displacement per frame across all detected bird regions (optical flow). Higher values indicate faster-moving birds or stronger wind conditions."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.filter(d => d["Avg Motion (px/frame)"] !== null)} margin={CHART_MARGIN_OVERALL}>
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

// ── Day to Day Analysis sub-components ───────────────────────────────────────

const CHART_MARGIN_DAILY = { top: 12, right: 24, bottom: 56, left: 64 };

function HourTick({ x, y, payload, index }) {
  if (index % 12 !== 0) return null;
  const hour = Math.round((index * 5) / 60);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
        {hour}h
      </text>
    </g>
  );
}

function DayChart({ row, dayNumber, cumulative }) {
  const raw = bucketize(row.birds_per_minute);
  if (raw.length === 0) {
    return (
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, marginBottom: 8 }}>
          Day {dayNumber}{row.recorded_at ? ` — ${row.recorded_at}` : ""}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No per-minute data available for this recording.</p>
      </div>
    );
  }

  const values = cumulative ? toCumulative(raw) : raw;
  const data = values.map((count, i) => ({ bucket: i, count }));

  const totalMinutes = raw.length * 5;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const durationLabel = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, color: "var(--charcoal)" }}>
          Day {dayNumber}{row.recorded_at ? ` — ${row.recorded_at}` : ""}
        </div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>
          {durationLabel} · {raw.reduce((s, v) => s + v, 0)} birds total
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={CHART_MARGIN_DAILY}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis dataKey="bucket" tick={<HourTick />} interval={0} tickLine={false}>
            <Label value="Time of day (hours)" position="insideBottom" offset={-40} fontSize={11} fill="var(--text-muted)" />
          </XAxis>
          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} width={40}>
            <Label
              value={cumulative ? "Cumulative count" : "Birds (per 5 min)"}
              angle={-90}
              position="insideLeft"
              offset={10}
              dy={cumulative ? 65 : 55}
              fontSize={11}
              fill="var(--text-muted)"
            />
          </YAxis>
          <Tooltip
            formatter={(v) => [v, cumulative ? "Cumulative birds" : "Birds"]}
            labelFormatter={(i) => {
              const totalMins = i * 5;
              const h = Math.floor(totalMins / 60);
              const m = totalMins % 60;
              return `${h}h ${m.toString().padStart(2, "0")}m`;
            }}
            contentStyle={{ borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }}
          />
          <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 4, fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="count"
            name={cumulative ? "Cumulative birds" : "Birds per 5 min"}
            stroke="var(--forest)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TimelineTab({ location, cumulative }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchResults(location);
      const sorted = [...data].sort((a, b) => {
        const da = a.recorded_at || a.upload_date || "";
        const db = b.recorded_at || b.upload_date || "";
        return da < db ? -1 : da > db ? 1 : 0;
      });
      setRows(sorted);
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
        No recordings yet
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20, maxWidth: 380, margin: "0 auto 20px" }}>
        Location {location} has no processed videos. Upload a field recording on the Process page first.
      </p>
      <button className="btn btn-outline" onClick={load}>Refresh</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
          {rows.length} DAY{rows.length !== 1 ? "S" : ""} RECORDED · LOCATION {location}
        </span>
        <button className="btn btn-outline" onClick={load} style={{ fontSize: 12, padding: "6px 14px" }}>
          Refresh
        </button>
      </div>
      {rows.map((row, i) => (
        <DayChart key={i} row={row} dayNumber={i + 1} cumulative={cumulative} />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Analysis() {
  const { locations } = useContext(LocationsContext);
  const [section, setSection] = useState("overall");
  const [activeTab, setActiveTab] = useState("");
  const [cumulative, setCumulative] = useState(false);

  useEffect(() => {
    if (locations.length > 0 && !locations.includes(activeTab)) {
      setActiveTab(locations[0]);
    }
  }, [locations]);

  return (
    <div className="page">
      <div style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Observation data</div>
        <h1 className="page-title">Analysis</h1>
      </div>

      {/* Section switcher */}
      <div className="tab-rail" style={{ marginBottom: 28 }}>
        <button
          className={`tab-item${section === "overall" ? " active" : ""}`}
          onClick={() => setSection("overall")}
        >
          Overall Experiment Analysis
        </button>
        <button
          className={`tab-item${section === "daily" ? " active" : ""}`}
          onClick={() => setSection("daily")}
        >
          Day to Day Analysis
        </button>
      </div>

      {section === "overall" && (
        <>
          <p className="page-subtitle" style={{ marginBottom: 12 }}>
            The dashboard summarizes several measures of bird activity from each recording:
          </p>
          <ul style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.8, marginTop: 0, marginBottom: 28, paddingLeft: 20, maxWidth: 680 }}>
            <li><strong style={{ color: "var(--charcoal)" }}>Bird Activity Index</strong> — standardized bird detections per unit of video time.</li>
            <li><strong style={{ color: "var(--charcoal)" }}>Peak concurrent activity</strong> — the maximum number of birds detected at the same time in a single frame.</li>
            <li><strong style={{ color: "var(--charcoal)" }}>Unique bird tracks</strong> — the number of distinct bird tracks identified during a recording.</li>
            <li><strong style={{ color: "var(--charcoal)" }}>Time to first detection</strong> — how long into the recording the first bird was detected.</li>
            <li><strong style={{ color: "var(--charcoal)" }}>Detection quality metrics</strong> — additional measures, such as track noise and motion, that help describe the reliability and characteristics of the detections.</li>
          </ul>

          {locations.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: "48px 32px" }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: "var(--charcoal)", marginBottom: 10 }}>
                No locations configured
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 380, margin: "0 auto 28px" }}>
                Add camera locations on the Process page to start collecting data.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "left" }}>
                <img src={sampleBph} alt="Sample bird activity index per hour chart" style={{ width: "100%", borderRadius: 6, border: "1px solid var(--border-light)" }} />
                <img src={sampleMaxConcurrent} alt="Sample max concurrent birds chart" style={{ width: "100%", borderRadius: 6, border: "1px solid var(--border-light)" }} />
                <img src={sampleUniqueBirds} alt="Sample unique flying birds over time chart" style={{ width: "100%", borderRadius: 6, border: "1px solid var(--border-light)" }} />
              </div>
            </div>


          ) : (
            <>
              <div className="tab-rail">
                {locations.map((loc) => (
                  <button
                    key={loc}
                    className={`tab-item${activeTab === loc ? " active" : ""}`}
                    onClick={() => setActiveTab(loc)}
                  >
                    {loc}
                  </button>
                ))}
              </div>
              {activeTab && <LocationTab key={activeTab} location={activeTab} />}
            </>
          )}
        </>
      )}

      {section === "daily" && (
        <>
          <p className="page-subtitle" style={{ marginBottom: 28 }}>
            Each chart below shows bird activity for a single recording day at the selected location.
            The X-axis runs across the recording in one-hour increments; the Y-axis shows birds counted
            per 5-minute window. Toggle <strong>Cumulative</strong> to see the running total instead of
            the raw count per window — useful for comparing how quickly activity accumulates across
            different days.
          </p>

          {locations.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: "48px 32px" }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: "var(--charcoal)", marginBottom: 10 }}>
                No locations configured
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 380, margin: "0 auto" }}>
                Add camera locations on the Process page to start collecting data.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div className="tab-rail" style={{ marginBottom: 0 }}>
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      className={`tab-item${activeTab === loc ? " active" : ""}`}
                      onClick={() => setActiveTab(loc)}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-outline"
                  onClick={() => setCumulative(c => !c)}
                  style={{ fontSize: 12, padding: "6px 16px", whiteSpace: "nowrap" }}
                >
                  {cumulative ? "Raw Count" : "Cumulative"}
                </button>
              </div>
              {activeTab && <TimelineTab key={`${activeTab}-daily`} location={activeTab} cumulative={cumulative} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
