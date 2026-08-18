import { useRef, useState } from "react";
import { wsUrl } from "../api";
import "../App.css";

const LOCATIONS = ["A", "B", "C"];
const CHUNK_SIZE = 1024 * 1024; // 1 MB

export default function Process() {
  const [location, setLocation] = useState("A");
  const [threshold, setThreshold] = useState(127);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | processing | done | error
  const [progress, setProgress] = useState(0);
  const [uniqueBirds, setUniqueBirds] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const canvasRef = useRef(null);
  const wsRef = useRef(null);

  function handleFileChange(e) {
    setFile(e.target.files[0] || null);
    setResult(null);
    setStatus("idle");
    setProgress(0);
    setUniqueBirds(0);
    setElapsed(0);
  }

  function drawFrame(bytes) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = new Blob([bytes], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function runDetection() {
    if (!file || !location) return;
    setStatus("uploading");
    setProgress(0);
    setResult(null);
    setErrorMsg("");

    const token = localStorage.getItem("token") || "";
    console.log("[runDetection] file:", file.name, "size:", (file.size / 1e6).toFixed(1), "MB",
                "location:", location, "threshold:", threshold,
                "token present:", !!token, "wsUrl:", wsUrl());

    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    console.log("[ws] opening connection to", wsUrl());

    ws.onopen = async () => {
      console.log("[ws] connected");
      // 1. Send metadata
      const meta = { token, location, filename: file.name, threshold };
      console.log("[ws] sending metadata", meta);
      ws.send(JSON.stringify(meta));

      // 2. Stream video in chunks
      setStatus("uploading");
      const buffer = await file.arrayBuffer();
      console.log("[ws] video buffer size:", (buffer.byteLength / 1e6).toFixed(1), "MB");
      let offset = 0;
      let chunkCount = 0;
      while (offset < buffer.byteLength) {
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        ws.send(chunk);
        offset += CHUNK_SIZE;
        chunkCount++;
        // small yield so the browser doesn't freeze on large files
        await new Promise((r) => setTimeout(r, 0));
      }
      console.log("[ws] upload done:", chunkCount, "chunks sent");

      // 3. Signal done
      ws.send(JSON.stringify({ done: true }));
      setStatus("processing");
      console.log("[ws] sent done signal, status → processing");
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Annotated JPEG frame
        console.log("[ws] frame received, bytes:", event.data.byteLength);
        drawFrame(event.data);
      } else {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          console.error("[ws] failed to parse text message:", event.data);
          return;
        }
        console.log("[ws] text message:", msg);
        if (msg.error) {
          console.error("[ws] server error:", msg.error);
          setStatus("error");
          setErrorMsg(msg.error);
        } else if (msg.done) {
          console.log("[ws] detection done, result:", msg);
          setResult(msg);
          setStatus("done");
        } else if ("progress" in msg) {
          setProgress(msg.progress);
          setUniqueBirds(msg.unique_birds);
          setElapsed(msg.elapsed);
        }
      }
    };

    ws.onerror = (event) => {
      console.error("[ws] WebSocket error event:", event);
      setStatus("error");
      setErrorMsg("Connection error. Please try again.");
    };

    ws.onclose = (event) => {
      console.log("[ws] closed — code:", event.code, "reason:", event.reason, "wasClean:", event.wasClean);
      if (status !== "done") setStatus((s) => (s === "processing" ? s : "idle"));
    };
  }

  const isRunning = status === "uploading" || status === "processing";

  return (
    <div className="page">
      <h1 style={{ fontSize: 28, marginBottom: 24, color: "#1e293b" }}>
        Process Video
      </h1>

      {/* Location picker */}
      <div className="card">
        <h2 style={{ fontSize: 17, marginBottom: 14, color: "#374151" }}>
          Select Location
        </h2>
        <div style={{ display: "flex", gap: 10 }}>
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocation(loc)}
              disabled={isRunning}
              className={`btn ${location === loc ? "btn-selected" : "btn-outline"}`}
              style={{ minWidth: 72, fontSize: 17 }}
            >
              Location {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Upload */}
      <div className="card">
        <h2 style={{ fontSize: 17, marginBottom: 14, color: "#374151" }}>
          Upload Video
        </h2>
        <input
          type="file"
          accept=".mp4,.avi,.mov,.mkv,.webm"
          onChange={handleFileChange}
          disabled={isRunning}
          style={{ marginBottom: 16, display: "block" }}
        />
        {file && (
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 14 }}>
            {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, color: "#374151", display: "block", marginBottom: 6 }}>
            Detection threshold: <strong>{threshold}</strong>
            <span style={{ color: "#64748b", marginLeft: 8, fontSize: 12 }}>
              (50–220 · lower = more sensitive, higher = less noise)
            </span>
          </label>
          <input
            type="range"
            min={50}
            max={220}
            step={5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            disabled={isRunning}
            style={{ width: "100%" }}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={runDetection}
          disabled={!file || isRunning}
        >
          {isRunning ? "Running…" : "Run Detection"}
        </button>
      </div>

      {/* Live stream + progress */}
      {(isRunning || status === "done") && (
        <div className="card">
          <h2 style={{ fontSize: 17, marginBottom: 14, color: "#374151" }}>
            {status === "done" ? "Detection Complete" : status === "uploading" ? "Uploading…" : "Detecting Birds (Live)"}
          </h2>

          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              border: "2px solid #e2e8f0",
              borderRadius: 8,
              background: "#0f172a",
              display: "block",
              minHeight: 200,
            }}
          />

          {status === "processing" && (
            <>
              <div className="progress-bar-outer">
                <div
                  className="progress-bar-inner"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 14, color: "#64748b" }}>
                <span>{Math.round(progress * 100)}% complete</span>
                <span>Unique birds so far: <strong>{uniqueBirds}</strong></span>
                <span>Elapsed: {Math.floor(elapsed / 60)}m {Math.round(elapsed % 60)}s</span>
              </div>
            </>
          )}

          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 13, color: "#64748b" }}>
            <span>
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#ffff00", border: "1px solid #ccc", marginRight: 5, verticalAlign: "middle" }} />
              Candidate (unconfirmed)
            </span>
            <span>
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#ff0000", border: "1px solid #ccc", marginRight: 5, verticalAlign: "middle" }} />
              Confirmed flying bird
            </span>
          </div>
        </div>
      )}

      {/* Result metrics */}
      {status === "done" && result && (
        <div className="card">
          <h2 style={{ fontSize: 17, marginBottom: 4, color: "#374151" }}>Results — Location {location}</h2>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Saved to GitHub automatically.</p>
          <div className="metric-grid">
            <div className="metric-card">
              <div className="value">{result.unique_flying_birds}</div>
              <div className="label">Unique Flying Birds</div>
            </div>
            <div className="metric-card">
              <div className="value">{result.max_concurrent_birds}</div>
              <div className="label">Max Concurrent</div>
            </div>
            <div className="metric-card">
              <div className="value">{result.duration_seconds?.toFixed(0)}s</div>
              <div className="label">Video Duration</div>
            </div>
            <div className="metric-card">
              <div className="value">{result.processing_time?.toFixed(0)}s</div>
              <div className="label">Processing Time</div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="card">
          <p className="error-msg">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
