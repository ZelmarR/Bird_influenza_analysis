import asyncio
import json
import logging
import os
import tempfile
import threading
import uuid
from datetime import datetime
from typing import Any

from dotenv import load_dotenv
load_dotenv()  # loads backend/.env when running locally; env vars from Railway take precedence

_REQUIRED_ENV = ["JWT_SECRET", "GITHUB_TOKEN", "GITHUB_REPO"]
_missing = [v for v in _REQUIRED_ENV if not os.environ.get(v)]
if _missing:
    raise RuntimeError(f"Missing required environment variables: {', '.join(_missing)}")

import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request, UploadFile, File, Form, status
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from auth import router as auth_router, get_current_user
from detection import process_video_streaming
from github_utils import download_csv, upload_csv, RESULTS_COLUMNS, download_locations, upload_locations

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bird_counter")

Location = str  # formerly Literal["A", "B", "C"] — now user-defined

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Bird Counter API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")

# In-memory job store: job_id -> state dict
_jobs: dict[str, dict] = {}


@app.get("/")
def health():
    return {"status": "ok"}


@app.get("/locations")
@limiter.limit("60/minute")
def get_locations(request: Request, user: str = Depends(get_current_user)):
    locs, _ = download_locations(user_email=user)
    return locs


class LocationBody(BaseModel):
    name: str


@app.post("/locations", status_code=201)
@limiter.limit("30/minute")
def add_location(request: Request, body: LocationBody, user: str = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Location name cannot be empty")
    if len(name) > 50:
        raise HTTPException(status_code=400, detail="Location name too long (max 50 chars)")
    locs, sha = download_locations(user_email=user)
    if name in locs:
        raise HTTPException(status_code=409, detail="Location already exists")
    locs.append(name)
    upload_locations(locs, sha, user_email=user)
    return locs


@app.delete("/locations/{name}")
@limiter.limit("30/minute")
def delete_location(request: Request, name: str, user: str = Depends(get_current_user)):
    locs, sha = download_locations(user_email=user)
    if name not in locs:
        raise HTTPException(status_code=404, detail="Location not found")
    locs = [l for l in locs if l != name]
    upload_locations(locs, sha, user_email=user)
    return locs


@app.get("/results/{location}")
@limiter.limit("30/minute")
def get_results(request: Request, location: Location, user: str = Depends(get_current_user)):
    df, _ = download_csv(location, user_email=user)
    records = df.to_dict(orient="records")
    return [{k: (None if isinstance(v, float) and v != v else v) for k, v in row.items()} for row in records]


@app.websocket("/ws/process")
async def process_video(websocket: WebSocket):
    await websocket.accept()
    log.info("WebSocket connection accepted")

    try:
        # First message: JSON metadata with JWT token
        log.debug("Waiting for metadata message...")
        meta_text = await websocket.receive_text()
        meta = json.loads(meta_text)
        log.info("Metadata received: filename=%s location=%s threshold=%s token_present=%s",
                 meta.get("filename"), meta.get("location"),
                 meta.get("threshold"), bool(meta.get("token")))

        token = meta.get("token", "")
        location = meta.get("location", "")
        filename = meta.get("filename", "video.mp4")
        threshold = max(50, min(220, int(meta.get("threshold", 127))))
        recorded_at = meta.get("recorded_at") or None

        # Validate token and location
        from auth import verify_token
        user = verify_token(token)
        if user is None:
            log.warning("Token verification failed — sending Unauthorized")
            await websocket.send_text(json.dumps({"error": "Unauthorized"}))
            await websocket.close(code=1008)
            return
        log.info("Token verified, user=%s", user)

        if not location:
            log.warning("Missing location")
            await websocket.send_text(json.dumps({"error": "Location is required"}))
            await websocket.close(code=1003)
            return

        # Receive video bytes in chunks
        suffix = os.path.splitext(filename)[1] or ".mp4"
        video_bytes = bytearray()
        chunk_count = 0

        log.debug("Receiving video chunks...")
        while True:
            msg = await websocket.receive()
            if "bytes" in msg and msg["bytes"]:
                video_bytes.extend(msg["bytes"])
                chunk_count += 1
                if chunk_count % 10 == 0:
                    log.debug("  received %d chunks, %.1f MB so far", chunk_count, len(video_bytes) / 1e6)
            elif "text" in msg:
                signal = json.loads(msg["text"])
                if signal.get("done"):
                    log.info("Upload complete: %d chunks, %.1f MB total", chunk_count, len(video_bytes) / 1e6)
                    break

        if len(video_bytes) == 0:
            log.error("Received 0 bytes — aborting")
            await websocket.send_text(json.dumps({"error": "No video data received"}))
            return

        # Write to temp file
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        try:
            tmp.write(bytes(video_bytes))
            tmp.flush()
            tmp.close()
            log.info("Temp file written: %s (%.1f MB)", tmp.name, os.path.getsize(tmp.name) / 1e6)

            # Verify OpenCV can open it before starting the generator
            import cv2 as _cv2
            probe = _cv2.VideoCapture(tmp.name)
            if not probe.isOpened():
                log.error("cv2.VideoCapture could not open temp file: %s", tmp.name)
                await websocket.send_text(json.dumps({"error": "Could not open video file — may be corrupt or unsupported format"}))
                return
            probe_frames = int(probe.get(_cv2.CAP_PROP_FRAME_COUNT))
            probe_fps = probe.get(_cv2.CAP_PROP_FPS)
            probe.release()
            log.info("Video probe: %d frames @ %.1f fps", probe_frames, probe_fps)

            # Stream annotated frames and progress
            result = None
            frames_sent = 0
            progress_sent = 0
            log.info("Starting detection generator (threshold=%d)...", threshold)

            async for item in async_generator(process_video_streaming(tmp.name, threshold=threshold)):
                kind = item["kind"]
                if kind == "frame":
                    _, jpeg = cv2.imencode(
                        ".jpg", item["frame"], [cv2.IMWRITE_JPEG_QUALITY, 70]
                    )
                    await websocket.send_bytes(jpeg.tobytes())
                    frames_sent += 1
                    if frames_sent == 1:
                        log.info("First annotated frame sent")
                elif kind == "progress":
                    await websocket.send_text(json.dumps({
                        "progress": item["progress"],
                        "unique_birds": item["unique_birds"],
                        "elapsed": item["elapsed"],
                    }))
                    progress_sent += 1
                    log.debug("Progress: %.1f%% unique_birds=%d elapsed=%.1fs",
                              item["progress"] * 100, item["unique_birds"], item["elapsed"])
                elif kind == "result":
                    result = item["data"]
                    log.info("Result received from generator: %s", result)

            log.info("Generator exhausted — frames_sent=%d progress_sent=%d result=%s",
                     frames_sent, progress_sent, result)

            if result:
                log.info("Saving result to GitHub...")
                try:
                    _save_result(result, filename, location, user=user, recorded_at=recorded_at)
                    log.info("GitHub save OK")
                except Exception as gh_err:
                    log.error("GitHub save failed: %s", gh_err)
                safe_result = {k: float(v) if hasattr(v, 'item') else v for k, v in result.items()}
                await websocket.send_text(json.dumps({"done": True, **safe_result}))
                log.info("Done message sent to client")
            else:
                log.error("Generator returned no result — sending error to client")
                await websocket.send_text(json.dumps({"error": "Detection failed — generator produced no result"}))

        finally:
            try:
                os.unlink(tmp.name)
                log.debug("Temp file deleted: %s", tmp.name)
            except Exception:
                pass

    except WebSocketDisconnect:
        log.info("WebSocket disconnected by client")
    except Exception as e:
        log.exception("Unhandled exception in WebSocket handler: %s", e)
        try:
            await websocket.send_text(json.dumps({"error": str(e)}))
        except Exception:
            pass


async def async_generator(sync_gen):
    """Run a synchronous generator in a thread pool so it doesn't block the event loop."""
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def run():
        try:
            for item in sync_gen:
                asyncio.run_coroutine_threadsafe(queue.put(item), loop).result()
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop).result()

    task = loop.run_in_executor(None, run)

    while True:
        item = await queue.get()
        if item is None:
            break
        yield item

    await task


@app.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    token: str = Form(...),
    location: str = Form(...),
    filename: str = Form(...),
    threshold: int = Form(127),
    recorded_at: str = Form(""),
):
    from auth import verify_token as _verify
    user = _verify(token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")
    threshold = max(50, min(220, threshold))

    suffix = os.path.splitext(filename)[1] or ".mp4"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.close()
    total_bytes = 0
    with open(tmp.name, "wb") as f:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
            total_bytes += len(chunk)
    log.info("Upload complete: %.1f MB written to %s", total_bytes / 1e6, tmp.name)

    if total_bytes == 0:
        os.unlink(tmp.name)
        raise HTTPException(status_code=400, detail="No video data received")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "queued", "progress": 0, "unique_birds": 0, "elapsed": 0}

    thread = threading.Thread(
        target=_run_job,
        args=(job_id, tmp.name, filename, location, threshold, user, recorded_at or None),
        daemon=True,
    )
    thread.start()
    log.info("Job %s queued for %s (%.1f MB)", job_id, filename, total_bytes / 1e6)
    return {"job_id": job_id}


@app.get("/job/{job_id}")
def get_job(job_id: str, user: str = Depends(get_current_user)):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _run_job(job_id: str, tmp_path: str, filename: str, location: str,
             threshold: int, user: str, recorded_at: str | None) -> None:
    _jobs[job_id]["status"] = "processing"
    log.info("Job %s starting detection on %s", job_id, tmp_path)
    try:
        result = None
        for item in process_video_streaming(tmp_path, threshold=threshold):
            if item["kind"] == "progress":
                _jobs[job_id].update({
                    "progress": item["progress"],
                    "unique_birds": item["unique_birds"],
                    "elapsed": item["elapsed"],
                })
            elif item["kind"] == "result":
                result = item["data"]
        if result:
            _save_result(result, filename, location, user=user, recorded_at=recorded_at)
            _jobs[job_id].update({"status": "done", "result": result, "progress": 1.0})
            log.info("Job %s done: %d unique birds", job_id, result.get("unique_flying_birds", 0))
        else:
            _jobs[job_id].update({"status": "error", "error": "Detection produced no result"})
            log.error("Job %s: generator produced no result", job_id)
    except Exception as e:
        _jobs[job_id].update({"status": "error", "error": str(e)})
        log.exception("Job %s failed: %s", job_id, e)
    finally:
        try:
            os.unlink(tmp_path)
            log.debug("Job %s: temp file deleted", job_id)
        except Exception:
            pass


def _save_result(result: dict, filename: str, location: str, user: str = "", recorded_at: str | None = None) -> None:
    df, sha = download_csv(location, user_email=user)
    new_row = {
        "video_name": filename,
        "location": location,
        "upload_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "recorded_at": recorded_at,
        "unique_flying_birds": result["unique_flying_birds"],
        "max_concurrent_birds": result["max_concurrent_birds"],
        "duration_seconds": round(result["duration_seconds"], 1),
        "processing_time": round(result["processing_time"], 1),
        "total_tracks": result.get("total_tracks"),
        "frames_processed": result.get("frames_processed"),
        "first_detection_second": result.get("first_detection_second"),
        "peak_concurrent_second": result.get("peak_concurrent_second"),
        "birds_per_minute": result.get("birds_per_minute"),
        "track_noise_ratio": result.get("track_noise_ratio"),
        "avg_motion_score": result.get("avg_motion_score"),
    }
    import pandas as pd
    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    for col in RESULTS_COLUMNS:
        if col not in df.columns:
            df[col] = None
    df = df[RESULTS_COLUMNS]
    upload_csv(df, sha, location, user_email=user)
