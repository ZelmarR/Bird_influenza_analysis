# Bird Counter App — Plan & Architecture

## Overview

A lightweight web application for researchers to upload bird videos, run automated bird detection, and track counts over time. Built with Streamlit (free deployment) and GitHub (free persistent storage). No credit card or cloud billing required.

---

## Problem

Researchers have a working Jupyter notebook (`video_counter_frame_percent (1).ipynb`) that counts unique flying birds in a video. The goal is to wrap this into a simple UI so that:

- Anyone on the team can upload a video without touching code
- Results are saved and accumulate over time
- A trend chart shows how bird counts change across videos

---

## Architecture

```
Researcher's browser
        │
        │  upload video (mp4/avi/mov/mkv/webm)
        ▼
Streamlit Community Cloud  (free hosting)
        │
        ├── detection.py
        │   └── process_video_with_unique_bird_counting()
        │       writes video to /tmp → runs OpenCV detection → returns result dict
        │       temp file deleted after processing
        │
        └── github_utils.py
            └── download_csv() / upload_csv()
                reads and writes results.csv via GitHub API
                        │
                        ▼
            Private GitHub repo  (free storage)
            └── results.csv   ← one row per video, persists forever
```

**Videos are never stored.** They are written to a temporary file during processing, then deleted. Only the numeric results are saved.

---

## File Structure

```
RA/
├── app.py                  # Streamlit UI — two tabs
├── detection.py            # Bird detection logic (extracted from notebook)
├── github_utils.py         # GitHub API helpers for results.csv
├── requirements.txt        # Python dependencies
├── PLAN.md                 # This file
├── .gitignore
└── .streamlit/
    ├── config.toml         # Max upload size
    └── secrets.toml        # GitHub token (NOT committed — template only)
```

---

## Files Explained

### `detection.py`

Extracted from `video_counter_frame_percent (1).ipynb`. All tkinter/GUI code removed. Core detection logic kept unchanged.

**What was removed:**
- `import tkinter` and all tkinter imports
- `select_video_folder()`, `process_single_video()`, `process_batch_videos()`, `run_bird_counter()`, `write_results_to_file()`

**What was kept:**
- Module-level constants: `FRAME_COVERAGE_PERCENTAGE`, `FRAME_SKIP`, `RESIZE_FACTOR`, `ENABLE_MULTIPROCESSING`, `MAX_WORKERS`
- Global: `prev_frame = None` — reset at the start of each call to `process_video_with_unique_bird_counting`
- `profile` decorator
- `EnhancedBirdTracker` class
- `detect_birds_in_frame()`
- `detect_moving_birds()`
- `process_video_with_unique_bird_counting()`

**Entry point called by the app:**
```python
result = process_video_with_unique_bird_counting(video_path, show_display=False)
```

Returns a dict:
```python
{
    "video_name":           str,
    "unique_flying_birds":  int,   # main result
    "max_concurrent_birds": int,
    "total_tracks":         int,
    "fps":                  int,
    "total_frames":         int,
    "frames_processed":     int,
    "duration_seconds":     float,
    "processing_time":      float,
    "processing_speed":     float,
    "video_path":           str,
}
```

**Important:** `requirements.txt` uses `opencv-python-headless` (not `opencv-python`) because Streamlit Community Cloud has no display server.

---

### `github_utils.py`

Reads and writes `results.csv` in a private GitHub repository using the GitHub Contents API. No external libraries — uses only `requests`.

| Function | What it does |
|---|---|
| `download_csv()` | Fetches `results.csv` from GitHub, returns `(DataFrame, sha)`. Returns empty DataFrame if file doesn't exist yet. |
| `upload_csv(df, sha)` | Commits updated `results.csv` back to GitHub. If `sha` is provided, updates the existing file; otherwise creates it. |

The `sha` value returned by `download_csv` is required by GitHub's API to update a file without conflict.

**Credentials read from `st.secrets["github"]`:**
- `token` — Personal Access Token with Contents: Read & Write permission
- `repo` — repository in `"username/repo-name"` format
- `results_path` — path inside the repo (default: `"results.csv"`)

---

### `app.py`

Two-tab Streamlit interface. No state is stored in memory between sessions — everything is fetched from GitHub on demand.

#### Tab 1 — Process Video

```
st.file_uploader()
→ st.button("Run Detection")
  → tempfile.NamedTemporaryFile(delete=False)   ← delete=False required: cv2 reopens by path
      write uploaded bytes → flush → close
  → process_video_with_unique_bird_counting(tmp_path, show_display=False)
  → os.unlink(tmp_path)                          ← temp file deleted
  → append_result()
      download_csv() → concat new row → upload_csv()
  → st.success() + 4 metric cards:
      Unique Flying Birds | Max Concurrent | Video Duration | Processing Time
```

#### Tab 2 — Analysis

```
download_csv() → DataFrame
st.dataframe()                        ← full results table
st.line_chart(unique_flying_birds)    ← trend over time
st.line_chart(max_concurrent_birds)   ← trend over time
Refresh button → clears cache and re-fetches from GitHub
```

---

### `requirements.txt`

```
streamlit>=1.35.0
opencv-python-headless>=4.9.0.80
numpy>=1.26.0
pandas>=2.2.0
requests>=2.31.0
```

---

### `.streamlit/secrets.toml` (template — never commit)

```toml
[github]
token        = "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN"
repo         = "YOUR_GITHUB_USERNAME/bird-counter-data"
results_path = "results.csv"
```

---

## Detection Logic (how it works)

The detection pipeline runs entirely inside `detection.py`:

```
Video file (path)
    │
    ├── cv2.VideoCapture() — read frame by frame
    │
    ├── Resize frame (RESIZE_FACTOR = 0.9) — faster processing
    │
    ├── Crop to top 60% of frame (FRAME_COVERAGE_PERCENTAGE = 0.6)
    │   birds fly in the upper portion of the sky
    │
    ├── detect_birds_in_frame()
    │   Grayscale → Gaussian blur (3×3) → Adaptive threshold →
    │   Morphological close → Find contours →
    │   Filter by area (10–1000px) and aspect ratio (0.3–4.0)
    │
    ├── detect_moving_birds()
    │   Frame differencing → mean pixel diff per detection bbox →
    │   Keep only detections where motion_score > 30
    │
    ├── EnhancedBirdTracker.update_tracks()
    │   Match detections to existing tracks by distance (<100px) →
    │   Vectorized distance calc for >50 tracks →
    │   Confirm a track as "flying" when:
    │     total_distance > 25px AND avg_movement > 2px/frame
    │     AND movement_consistency > 0.3
    │
    └── EnhancedBirdTracker.get_unique_flying_birds_count()
        Returns count of all track IDs ever confirmed as flying
```

**Key parameters:**

| Parameter | Value | Effect |
|---|---|---|
| `FRAME_COVERAGE_PERCENTAGE` | 0.6 | Only top 60% of frame is scanned |
| `FRAME_SKIP` | 1 | Every frame is processed |
| `RESIZE_FACTOR` | 0.9 | Frame shrunk to 90% for speed |
| `motion_threshold` | 30 | Min mean pixel diff to count as moving |
| `min_flight_duration` | 8 frames | Track must persist 8 frames to be counted |
| `min_movement_distance` | 25px | Track must move 25px total to be counted |

---

## Data Flow: Upload to Saved Result

```
1. Researcher uploads video in browser
2. Streamlit writes bytes to /tmp/tmpXXXX.mp4  (delete=False)
3. process_video_with_unique_bird_counting("/tmp/tmpXXXX.mp4") runs
4. os.unlink("/tmp/tmpXXXX.mp4")  — temp file deleted
5. download_csv() fetches current results.csv from GitHub (or empty DataFrame)
6. New row appended: video_name, upload_date, unique_flying_birds,
                     max_concurrent_birds, duration_seconds, processing_time
7. upload_csv() commits updated results.csv back to GitHub
8. Metrics displayed in the UI
```

---

## One-Time Setup (before first run)

### 1. Create a private GitHub repo for data

Create a new **private** repository (e.g. `yourname/bird-counter-data`). This will hold only `results.csv`. Keep it separate from the code repo.

### 2. Create a GitHub Personal Access Token

- GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
- Repository access: select only `bird-counter-data`
- Permission: **Contents → Read and Write**
- Copy the generated token

### 3. Fill in secrets

Edit `.streamlit/secrets.toml`:
```toml
[github]
token        = "github_pat_..."
repo         = "yourname/bird-counter-data"
results_path = "results.csv"
```

### 4. Test locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

---

## Deployment to Streamlit Community Cloud

1. Push the code to a GitHub repo (your **code** repo — not the data repo):
   ```
   app.py, detection.py, github_utils.py, requirements.txt,
   PLAN.md, .gitignore, .streamlit/config.toml
   ```
   Do **not** push `.streamlit/secrets.toml`.

2. Go to [share.streamlit.io](https://share.streamlit.io) → New app
3. Connect GitHub → select the code repo → set main file: `app.py`
4. Advanced Settings → paste the full contents of `secrets.toml` into the Secrets field
5. Deploy → share the generated URL with researchers

No credit card. No billing. Completely free.

---

## Verification Checklist

- [ ] Upload a short test video (< 100 MB) — metrics appear after processing
- [ ] Switch to Analysis tab — one row in table, chart renders
- [ ] Upload a second video — two rows appear, chart shows both points
- [ ] Check the private GitHub repo — `results.csv` exists with correct columns
- [ ] Trigger a Streamlit Cloud redeploy (push any commit) — data still present (lives in GitHub, not on ephemeral disk)
- [ ] Click Refresh on Analysis tab — latest data loads

---

## Limitations & Known Constraints

| Constraint | Detail |
|---|---|
| Streamlit Cloud RAM | 1 GB limit. Large videos are processed frame-by-frame so memory stays low. If needed, increase `FRAME_SKIP` or reduce `RESIZE_FACTOR` in `detection.py`. |
| Streamlit Cloud disk | Ephemeral `/tmp` — only used during processing, deleted immediately after. |
| GitHub API rate limit | 5,000 requests/hour per token — far more than needed for a small research team. |
| GitHub file size | `results.csv` is plain text; will stay well under GitHub's 100 MB file limit for years. |
| Concurrent uploads | App processes one video at a time per session. Multiple researchers uploading simultaneously is safe — each session reads and writes independently. |
| Video storage | Videos are **not** stored anywhere. Researchers must keep their own original files. |
