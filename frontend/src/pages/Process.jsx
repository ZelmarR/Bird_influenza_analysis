import { useRef, useState } from "react";
import { wsUrl } from "../api";

const LOCATIONS = ["A", "B", "C"];
const CHUNK_SIZE = 1024 * 1024;

export default function Process() {
  const [location,     setLocation]     = useState("A");
  const [threshold,    setThreshold]    = useState(127);
  const [file,         setFile]         = useState(null);
  const [recordedDate, setRecordedDate] = useState("");
  const [recordedTime, setRecordedTime] = useState("");
  const [status,       setStatus]       = useState("idle");
  const [progress,     setProgress]     = useState(0);
  const [uniqueBirds,  setUniqueBirds]  = useState(0);
  const [elapsed,      setElapsed]      = useState(0);
  const [result,       setResult]       = useState(null);
  const [errorMsg,     setErrorMsg]     = useState("");
  const [dragOver,     setDragOver]     = useState(false);
  const canvasRef = useRef(null);
  const wsRef     = useRef(null);

  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f); setResult(null); setStatus("idle");
    setProgress(0); setUniqueBirds(0); setElapsed(0);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0] || null;
    if (f) { setFile(f); setResult(null); setStatus("idle"); setProgress(0); }
  }

  function drawFrame(bytes) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = new Blob([bytes], { type: "image/jpeg" });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function runDetection() {
    if (!file || !location) return;
    setStatus("uploading"); setProgress(0); setResult(null); setErrorMsg("");
    const token = localStorage.getItem("token") || "";
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      const recorded_at = recordedDate && recordedTime
        ? `${recordedDate}T${recordedTime}`
        : recordedDate || undefined;
      ws.send(JSON.stringify({ token, location, filename: file.name, threshold, recorded_at }));
      setStatus("uploading");
      const buffer = await file.arrayBuffer();
      let offset = 0;
      while (offset < buffer.byteLength) {
        ws.send(buffer.slice(offset, offset + CHUNK_SIZE));
        offset += CHUNK_SIZE;
        await new Promise(r => setTimeout(r, 0));
      }
      ws.send(JSON.stringify({ done: true }));
      setStatus("processing");
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        drawFrame(event.data);
      } else {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.error) { setStatus("error"); setErrorMsg(msg.error); }
        else if (msg.done) { setResult(msg); setStatus("done"); }
        else if ("progress" in msg) {
          setProgress(msg.progress);
          setUniqueBirds(msg.unique_birds);
          setElapsed(msg.elapsed);
        }
      }
    };

    ws.onerror = () => { setStatus("error"); setErrorMsg("Connection error. Please try again."); };
    ws.onclose = () => { if (status !== "done") setStatus(s => s === "processing" ? s : "idle"); };
  }

  const isRunning = status === "uploading" || status === "processing";
  const pct = Math.round(progress * 100);
  const thPct = ((threshold - 50) / 170 * 100).toFixed(1);

  return (
    <div className="page">

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Detection pipeline</div>
        <h1 className="page-title">Process a Recording</h1>
        <p className="page-subtitle">
          Configure the detection run, upload your field video, and watch annotated
          frames stream back in real time.
        </p>
      </div>

      {/* ── Config row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Location */}
        <div className="panel">
          <div className="panel-label">Camera location</div>
          <div className="location-grid">
            {LOCATIONS.map(loc => (
              <button
                key={loc}
                className={`loc-btn${location === loc ? " active" : ""}`}
                onClick={() => setLocation(loc)}
                disabled={isRunning}
              >
                <span className="loc-btn-id">{loc}</span>
                <span className="loc-btn-label">Location</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date & time */}
        <div className="panel">
          <div className="panel-label">Recording timestamp</div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
              <label>Date</label>
              <input type="date" value={recordedDate} onChange={e => setRecordedDate(e.target.value)} disabled={isRunning} />
            </div>
            <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
              <label>Time</label>
              <input type="time" value={recordedTime} onChange={e => setRecordedTime(e.target.value)} disabled={isRunning} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
            Used as the X-axis label in the Analysis charts.
          </p>
        </div>
      </div>

      {/* ── Threshold ── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-label">Detection sensitivity</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <input
              type="range" min={50} max={220} step={5}
              value={threshold}
              style={{ "--pct": `${thPct}%` }}
              onChange={e => setThreshold(Number(e.target.value))}
              disabled={isRunning}
            />
            <div className="threshold-labels">
              <span>50 — highly sensitive</span>
              <span>220 — minimal noise</span>
            </div>
          </div>
          <div style={{
            minWidth: 64, textAlign: "center",
            fontFamily: "'DM Mono', monospace", fontSize: 22,
            fontWeight: 500, color: "var(--forest)",
            background: "var(--sage-light)", borderRadius: 5,
            padding: "8px 12px",
          }}>
            {threshold}
          </div>
        </div>
      </div>

      {/* ── Upload ── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-label">Video file</div>
        <div
          className={`dropzone${dragOver ? " drag-over" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input type="file" accept=".mp4,.avi,.mov,.mkv,.webm" onChange={handleFileChange} disabled={isRunning} />
          {file ? (
            <>
              <span className="dropzone-icon">🎥</span>
              <div className="dropzone-text">{file.name}</div>
              <div className="dropzone-sub">{(file.size / 1024 / 1024).toFixed(1)} MB · Click or drag to replace</div>
            </>
          ) : (
            <>
              <span className="dropzone-icon">↑</span>
              <div className="dropzone-text">Drag a video here, or click to browse</div>
              <div className="dropzone-sub">.mp4 · .avi · .mov · .mkv · .webm</div>
            </>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            className="btn btn-primary"
            onClick={runDetection}
            disabled={!file || isRunning}
            style={{ minWidth: 180 }}
          >
            {isRunning
              ? (status === "uploading" ? "Uploading…" : "Detecting…")
              : "Run detection"}
          </button>
        </div>
      </div>

      {/* ── Live viewport ── */}
      {(isRunning || status === "done") && (
        <div className="panel" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
          <div className="detection-viewport">
            <canvas ref={canvasRef} />

            {/* HUD bar */}
            <div className="viewport-overlay-bar">
              {status === "processing" && (
                <span className="viewport-badge badge-live">Live Analysis</span>
              )}
              {status === "done" && (
                <span className="viewport-badge badge-mono">Analysis complete</span>
              )}
              {status === "uploading" && (
                <span className="viewport-badge badge-mono">Uploading…</span>
              )}
              <span className="viewport-badge badge-mono" style={{ marginLeft: "auto" }}>
                Location {location}
              </span>
            </div>

            {/* Empty state */}
            {status === "uploading" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
                  UPLOADING VIDEO
                </div>
              </div>
            )}
          </div>

          {/* Progress + stats */}
          {status === "processing" && (
            <div style={{ padding: "14px 20px" }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-meta">
                <span>{pct}% complete</span>
                <span>{uniqueBirds} bird{uniqueBirds !== 1 ? "s" : ""} detected</span>
                <span>{Math.floor(elapsed / 60)}m {Math.round(elapsed % 60)}s elapsed</span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ padding: "0 20px 16px" }}>
            <div className="legend">
              <span>
                <span className="legend-dot" style={{ background: "#facc15" }} />
                Candidate — unconfirmed detection
              </span>
              <span>
                <span className="legend-dot" style={{ background: "#ef4444" }} />
                Confirmed flying bird
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {status === "done" && result && (
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-label">Session results — Location {location}</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Saved to your account automatically.
          </p>
          <div className="metric-strip">
            {[
              { v: result.unique_flying_birds,           l: "Unique Flying Birds" },
              { v: result.max_concurrent_birds,          l: "Peak Concurrent" },
              { v: `${result.duration_seconds?.toFixed(0)}s`,  l: "Recording Duration" },
              { v: `${result.processing_time?.toFixed(0)}s`,   l: "Processing Time" },
            ].map(({ v, l }) => (
              <div key={l} className="metric-cell">
                <div className="metric-cell-value">{v}</div>
                <div className="metric-cell-label">{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {status === "error" && (
        <div className="error-banner" style={{ marginBottom: 0 }}>
          {errorMsg}
        </div>
      )}

    </div>
  );
}
