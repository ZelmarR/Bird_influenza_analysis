import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fetchResults } from "../api";
import "../App.css";

const LOCATIONS = ["A", "B", "C"];

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

  const chartData = rows.map((r, i) => ({
    name: r.upload_date || `Video ${i + 1}`,
    "Unique Birds": r.unique_flying_birds,
    "Max Concurrent": r.max_concurrent_birds,
  }));

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
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.video_name}
                </td>
                <td>{r.upload_date}</td>
                <td><strong>{r.unique_flying_birds}</strong></td>
                <td>{r.max_concurrent_birds}</td>
                <td>{r.duration_seconds}</td>
                <td>{r.processing_time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
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
            <Line type="monotone" dataKey="Unique Birds" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
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
            <Line type="monotone" dataKey="Max Concurrent" stroke="#0891b2" strokeWidth={2} dot={{ r: 4 }} />
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
