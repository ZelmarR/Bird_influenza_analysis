import { useRef, useState, useEffect, useContext } from "react";
import { wsUrl, uploadVideo, fetchJob, addLocation, deleteLocation } from "../api";
import { LocationsContext } from "../App";

const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50 MB — below this uses WebSocket live preview
const CHUNK_SIZE = 1024 * 1024; // 1 MB slices for WebSocket streaming

export default function Process() {
  const { locations, reload: reloadLocations } = useContext(LocationsContext);
  const [location,     setLocation]     = useState("");
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
  const [jobId,        setJobId]        = useState(null);
  const [isLargeFile,  setIsLargeFile]  = useState(false);
  const [newLocName,   setNewLocName]   = useState("");
  const [locError,     setLocError]     = useState("");
  const [locLoading,   setLocLoading]   = useState(false);
  const canvasRef   = useRef(null);
  const wsRef       = useRef(null);
  const pollRef     = useRef(null);

  // Auto-select first location when locations load
  useEffect(() => {
    if (locations.length > 0 && !locations.includes(location)) {
      setLocation(locations[0]);
    }
  }, [locations]);

  async function handleAddLocation(e) {
    e.preventDefault();
    const name = newLocName.trim();
    if (!name) return;
    setLocLoading(true); setLocError("");
    try {
      await addLocation(name);
      setNewLocName("");
      await reloadLocations();
      setLocation(name);
    } catch (err) {
      setLocError(err.message);
    } finally {
      setLocLoading(false);
    }
  }

  async function handleDeleteLocation(name) {
    setLocLoading(true); setLocError("");
    try {
      await deleteLocation(name);
      await reloadLocations();
    } catch (err) {
      setLocError(err.message);
    } finally {
      setLocLoading(false);
    }
  }

  // Poll job status for background jobs
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const job = await fetchJob(jobId);
        setProgress(job.progress || 0);
        setUniqueBirds(job.unique_birds || 0);
        setElapsed(job.elapsed || 0);
        if (job.status === "done") {
          clearInterval(pollRef.current);
          setResult(job.result);
          setStatus("done");
        } else if (job.status === "error") {
          clearInterval(pollRef.current);
          setStatus("error");
          setErrorMsg(job.error || "Processing failed.");
        } else if (job.status === "processing") {
          setStatus("processing");
        }
      } catch {
        // polling errors are transient; keep trying
      }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [jobId]);

  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f); setResult(null); setStatus("idle");
    setProgress(0); setUniqueBirds(0); setElapsed(0); setJobId(null);
    setIsLargeFile(f ? f.size >= LARGE_FILE_THRESHOLD : false);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0] || null;
    if (f) {
      setFile(f); setResult(null); setStatus("idle"); setProgress(0); setJobId(null);
      setIsLargeFile(f.size >= LARGE_FILE_THRESHOLD);
    }
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
    setStatus("uploading"); setProgress(0); setResult(null); setErrorMsg(""); setJobId(null);
    const token = localStorage.getItem("token") || "";
    const recorded_at = recordedDate && recordedTime
      ? `${recordedDate} ${recordedTime}`
      : recordedDate || null;

    if (file.size >= LARGE_FILE_THRESHOLD) {
      // Background job path for large files
      try {
        const { job_id } = await uploadVideo(
          { file, token, location, filename: file.name, threshold: THRESHOLD, recorded_at },
          (pct) => setProgress(pct * 0.5), // upload = first 50% of progress bar
        );
        setJobId(job_id);
        setStatus("queued");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err.message || "Upload failed.");
      }
      return;
    }

    // WebSocket path for files < 500 MB
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      ws.send(JSON.stringify({ token, location, filename: file.name, threshold: THRESHOLD, recorded_at }));
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
    ws.onclose = () => { setStatus(s => (s === "done" || s === "error") ? s : "idle"); };
  }

  const THRESHOLD = 127;
  const isRunning = status === "uploading" || status === "processing" || status === "queued";
  const pct = Math.round(progress * 100);

  return (
    <div className="page">

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Detection pipeline</div>
        <h1 className="page-title">Process a Recording</h1>
        <p className="page-subtitle">
          Upload a field video and the system will automatically count every flying bird,
          measure peak activity, and save the results to your location's record.
        </p>
        <p className="page-subtitle" style={{ marginTop: 10 }}>
          Birds cause crop losses by arriving at predictable spots and times.
          Recording footage at each vulnerable location — feed areas, open crop rows,
          water sources — and processing it here builds the evidence you need to deploy
          deterrents where and when they will actually work.
        </p>
      </div>

      {/* ── Config row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Location */}
        <div className="panel">
          <div className="panel-label">Camera location</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 12px", lineHeight: 1.6 }}>
            Each location is a distinct spot on your farm where you have placed a camera —
            for example <em>North Field</em>, <em>Feed Barn</em>, or <em>Gate Row</em>.
            Keeping locations separate lets you compare which spots attract the most birds
            and at what times, so you can target deterrents precisely.
            Add as many locations as you have camera sites. To log a recording, select the
            location it was filmed at before uploading.
          </p>

          {locations.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "10px 0" }}>
              No locations added yet — use the field below to add your first camera site.
            </p>
          ) : (
            <div className="location-grid">
              {locations.map(loc => (
                <div key={loc} style={{ position: "relative", display: "inline-flex" }}>
                  <button
                    className={`loc-btn${location === loc ? " active" : ""}`}
                    onClick={() => setLocation(loc)}
                    disabled={isRunning}
                    style={{ paddingRight: 28 }}
                  >
                    <span className="loc-btn-id" style={{ fontSize: Math.max(10, 18 - Math.max(0, loc.length - 3)) }}>{loc}</span>
                    <span className="loc-btn-label">Location</span>
                  </button>
                  {!isRunning && (
                    <button
                      onClick={() => handleDeleteLocation(loc)}
                      disabled={locLoading}
                      title={`Remove ${loc}`}
                      style={{
                        position: "absolute", top: 4, right: 4,
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-muted)", fontSize: 13, lineHeight: 1,
                        padding: "2px 3px", borderRadius: 3,
                      }}
                    >×</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add location form */}
          <form onSubmit={handleAddLocation} style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <input
              type="text"
              value={newLocName}
              onChange={e => { setNewLocName(e.target.value); setLocError(""); }}
              placeholder="e.g. North Field, Feed Barn, Gate Row"
              maxLength={50}
              disabled={isRunning || locLoading}
              style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
            />
            <button
              type="submit"
              className="btn btn-outline"
              disabled={!newLocName.trim() || isRunning || locLoading}
              style={{ fontSize: 12, padding: "6px 14px", whiteSpace: "nowrap" }}
            >
              + Add
            </button>
          </form>
          {locError && (
            <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>{locError}</p>
          )}
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
              {isLargeFile && (
                <div className="dropzone-sub" style={{ marginTop: 6, color: "var(--forest)", fontWeight: 500 }}>
                  Large file — uploaded in 5 MB chunks with automatic retry. Safe to leave this tab open while it uploads. Processing runs in the background; check the Analysis page for results.
                </div>
              )}
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

      {/* ── Background job status panel (large files) ── */}
      {isLargeFile && (status === "uploading" || jobId) && (status === "uploading" || status === "queued" || status === "processing" || status === "done") && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-label">Background job — Location {location}</div>
          {status === "uploading" && (
            <>
              <div className="progress-track" style={{ marginTop: 12 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-meta">
                <span>{pct}% uploaded</span>
                <span style={{ color: "var(--text-muted)" }}>Uploading in chunks — do not close this tab</span>
              </div>
            </>
          )}
          {status === "queued" && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "10px 0 0" }}>
              Video received. Detection will begin shortly — you can close this tab and return later.
            </p>
          )}
          {status === "processing" && (
            <>
              <div className="progress-track" style={{ marginTop: 12 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-meta">
                <span>{pct}% complete</span>
                <span>{uniqueBirds} bird{uniqueBirds !== 1 ? "s" : ""} detected</span>
                <span>{Math.floor(elapsed / 60)}m {Math.round(elapsed % 60)}s elapsed</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Processing in background — this page polls every 5 s. Safe to close and check Analysis later.
              </p>
            </>
          )}
          {status === "done" && (
            <p style={{ fontSize: 13, color: "var(--forest)", margin: "10px 0 0", fontWeight: 500 }}>
              Processing complete. Results saved to your account.
            </p>
          )}
        </div>
      )}

      {/* ── Live viewport (WebSocket / small files only) ── */}
      {!isLargeFile && (isRunning || status === "done") && (
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
