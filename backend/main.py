import asyncio
import json
import logging
import os
import tempfile
from datetime import datetime
from typing import Literal

from dotenv import load_dotenv
load_dotenv()  # loads backend/.env when running locally; env vars from Railway take precedence

_REQUIRED_ENV = ["JWT_SECRET", "GITHUB_TOKEN", "GITHUB_REPO"]
_missing = [v for v in _REQUIRED_ENV if not os.environ.get(v)]
if _missing:
    raise RuntimeError(f"Missing required environment variables: {', '.join(_missing)}")

import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router, get_current_user
from detection import process_video_streaming
from github_utils import download_csv, upload_csv, RESULTS_COLUMNS

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bird_counter")

Location = Literal["A", "B", "C"]

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app = FastAPI(title="Bird Counter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")


@app.get("/")
def health():
    return {"status": "ok"}


@app.get("/results/{location}")
def get_results(location: Location, user: str = Depends(get_current_user)):
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

        if location not in ("A", "B", "C"):
            log.warning("Invalid location: %r", location)
            await websocket.send_text(json.dumps({"error": "Invalid location"}))
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
                await websocket.send_text(json.dumps({"done": True, **result}))
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
