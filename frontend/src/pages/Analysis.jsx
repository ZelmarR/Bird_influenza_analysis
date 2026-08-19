import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fetchResults } from "../api";
import "../App.css";

const LOCATIONS = ["A", "B", "C"];

function fmt(val, decimals = 1) {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  return isNaN(n) ? "—" : n.toFixed(decimals);
}

function StatTile({ label, value }) {
  return (
    <div style={{
      flex: "1 1 160px",
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      padding: "14px 18px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1e293b" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function LocationTab({ location }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchResults(location);
      setRows(data);
      if (data.length > 0) setSelectedVideo(data[data.length - 1].video_name);
    } catch {
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [location]);

  if (loading) return <p style={{ color: "#64748b" }}>Loading…</p>;
  if (error) return <p className="error-msg">{error}</p>;
  if (rows.length === 0) return (
    <div>
      <p style={{ color: "#64748b", marginBottom: 16 }}>
        No results yet for Location {location}. Process a video first.
      </p>
      <button className="btn btn-outline" onClick={load}>Refresh</button>
    </div>
  );

  // Cross-video chart data
  const chartData = rows.map((r, i) => ({
    name: r.upload_date || `Video ${i + 1}`,
    "Unique Birds": r.unique_flying_birds,
    "Max Concurrent": r.max_concurrent_birds,
    "Detection Latency (s)": r.first_detection_second != null && r.first_detection_second !== "" ? Number(r.first_detection_second) : null,
    "Track Noise Ratio": r.track_noise_ratio != null && r.track_noise_ratio !== "" ? Number(r.track_noise_ratio) : null,
    "Avg Motion Score": r.avg_motion_score != null && r.avg_motion_score !== "" ? Number(r.avg_motion_score) : null,
  }));

  // Summary stats
  const totalBirds = rows.reduce((s, r) => s + (Number(r.unique_flying_birds) || 0), 0);
  const avgBirds = rows.length > 0 ? (totalBirds / rows.length).toFixed(1) : 0;
  const maxBirds = Math.max(...rows.map(r => Number(r.unique_flying_birds) || 0));
  const latencyRows = rows.filter(r => r.first_detection_second != null && r.first_detection_second !== "");
  const avgLatency = latencyRows.length > 0
    ? (latencyRows.reduce((s, r) => s + Number(r.first_detection_second), 0) / latencyRows.length).toFixed(1)
    : "—";

  // Birds-per-minute for selected video
  const selectedRow = rows.find(r => r.video_name === selectedVideo);
  let bpmData = [];
  if (selectedRow?.birds_per_minute) {
    try {
      const arr = JSON.parse(selectedRow.birds_per_minute);
      bpmData = arr.map((count, i) => ({ minute: `Min ${i + 1}`, "Birds Confirmed": count }));
    } catch { /* malformed JSON — leave empty */ }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ color: "#374151", fontSize: 16 }}>
          {rows.length} video{rows.length !== 1 ? "s" : ""} processed
        </h3>
        <button className="btn btn-outline" onClick={load} style={{ fontSize: 13, padding: "6px 14px" }}>
          Refresh
        </button>
      </div>

      {/* Summary stat tiles */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        <StatTile label="Total Unique Birds" value={totalBirds} />
        <StatTile label="Avg Birds / Video" value={avgBirds} />
        <StatTile label="Highest Single Video" value={maxBirds} />
        <StatTile label="Avg Detection Latency (s)" value={avgLatency} />
      </div>

      {/* Results table */}
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <table>
          <thead>
            <tr>
              <th>Video</th>
              <th>Date</th>
              <th>Unique Birds</th>
              <th>Max Concurrent</th>
              <th>Duration (s)</th>
              <th>Processing (s)</th>
              <th>First Detection (s)</th>
              <th>Peak Second</th>
              <th>Noise Ratio</th>
              <th>Avg Motion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.video_name}
                </td>
                <td>{r.upload_date}</td>
                <td><strong>{r.unique_flying_birds}</strong></td>
                <td>{r.max_concurrent_birds}</td>
                <td>{r.duration_seconds}</td>
                <td>{r.processing_time}</td>
                <td>{fmt(r.first_detection_second)}</td>
                <td>{fmt(r.peak_concurrent_second)}</td>
                <td>{fmt(r.track_noise_ratio, 3)}</td>
                <td>{fmt(r.avg_motion_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart 1: Unique Flying Birds Over Time */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16, color: "#374151" }}>
          Unique Flying Birds Over Time
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Unique Birds" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Max Concurrent Birds Over Time */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16, color: "#374151" }}>
          Max Concurrent Birds Over Time
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Max Concurrent" stroke="#0891b2" strokeWidth={2} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Detection Latency Over Time */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, marginBottom: 4, color: "#374151" }}>
          Detection Latency Over Time
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
          Seconds into the video before the first confirmed bird — lower means earlier activity.
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData.filter(d => d["Detection Latency (s)"] !== null)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="s" />
            <Tooltip formatter={(v) => [`${v}s`, "Detection Latency"]} />
            <Legend />
            <Line type="monotone" dataKey="Detection Latency (s)" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Birds Per Minute (per-video breakdown) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <h3 style={{ fontSize: 15, marginBottom: 4, color: "#374151" }}>
              Birds Per Minute — Per Video Breakdown
            </h3>
            <p style={{ fontSize: 12, color: "#64748b" }}>
              New bird confirmations per minute within a single video.
            </p>
          </div>
          <select
            value={selectedVideo || ""}
            onChange={e => setSelectedVideo(e.target.value)}
            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff" }}
          >
            {rows.map((r, i) => (
              <option key={i} value={r.video_name}>{r.video_name || `Video ${i + 1}`}</option>
            ))}
          </select>
        </div>
        {bpmData.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>No per-minute data for this video (processed before this feature).</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bpmData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="minute" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Birds Confirmed" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 5: Track Noise Ratio Over Time */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, marginBottom: 4, color: "#374151" }}>
          Track Noise Ratio Over Time
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
          Confirmed birds ÷ total track attempts. Higher = cleaner detections; lower = more noise/false positives.
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData.filter(d => d["Track Noise Ratio"] !== null)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} />
            <Tooltip formatter={(v) => [v?.toFixed(3), "Noise Ratio"]} />
            <Legend />
            <Line type="monotone" dataKey="Track Noise Ratio" stroke="#d97706" strokeWidth={2} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Average Motion Score Over Time */}
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 4, color: "#374151" }}>
          Average Motion Score Over Time
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
          Mean optical flow intensity across all detections. Higher = faster / more active bird movement.
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData.filter(d => d["Avg Motion Score"] !== null)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [v?.toFixed(2), "Avg Motion Score"]} />
            <Legend />
            <Line type="monotone" dataKey="Avg Motion Score" stroke="#e11d48" strokeWidth={2} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Analysis() {
  const [activeTab, setActiveTab] = useState("A");

  return (
    <div className="page">
      <h1 style={{ fontSize: 28, marginBottom: 24, color: "#1e293b" }}>
        Analysis
      </h1>

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
