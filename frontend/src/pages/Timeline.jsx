import { useEffect, useState, useContext } from "react";
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label,
} from "recharts";
import { fetchResults } from "../api";
import { LocationsContext } from "../App";
import "../App.css";

const CHART_MARGIN = { top: 12, right: 24, bottom: 56, left: 64 };

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

// X-axis tick: show hour label only at hour boundaries (every 12th bucket = 1 hour)
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
        <LineChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis
            dataKey="bucket"
            tick={<HourTick />}
            interval={0}
            tickLine={false}
          >
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
      // Sort oldest first by recorded_at, falling back to upload_date
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

export default function Timeline() {
  const { locations } = useContext(LocationsContext);
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
        <div className="page-eyebrow">Daily patterns</div>
        <h1 className="page-title">Timeline</h1>
        <p className="page-subtitle">
          Bird activity across the day for each recording. One chart per day, building up over the monitoring cycle.
        </p>
      </div>

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

          {activeTab && <TimelineTab key={activeTab} location={activeTab} cumulative={cumulative} />}
        </>
      )}
    </div>
  );
}
