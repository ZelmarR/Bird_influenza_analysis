import base64
import io
import time

import pandas as pd
import requests
import streamlit as st

RESULTS_COLUMNS = [
    "video_name",
    "upload_date",
    "unique_flying_birds",
    "max_concurrent_birds",
    "duration_seconds",
    "processing_time",
]

# GitHub API base
_API = "https://api.github.com"


def _headers() -> dict:
    token = st.secrets["github"]["token"]
    return {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}


def _repo() -> str:
    return st.secrets["github"]["repo"]  # e.g. "username/bird-counter-data"


def _path() -> str:
    return st.secrets["github"].get("results_path", "results.csv")


_RETRY_STATUSES = {429, 500, 502, 503, 504}
_MAX_RETRIES = 4


def _get_with_retry(url: str, **kwargs) -> requests.Response:
    for attempt in range(_MAX_RETRIES):
        resp = requests.get(url, **kwargs)
        if resp.status_code not in _RETRY_STATUSES:
            return resp
        if attempt < _MAX_RETRIES - 1:
            time.sleep(2 ** attempt)
    return resp


def _put_with_retry(url: str, **kwargs) -> requests.Response:
    for attempt in range(_MAX_RETRIES):
        resp = requests.put(url, **kwargs)
        if resp.status_code not in _RETRY_STATUSES:
            return resp
        if attempt < _MAX_RETRIES - 1:
            time.sleep(2 ** attempt)
    return resp


def download_csv() -> tuple[pd.DataFrame, str | None]:
    """
    Fetch results.csv from the GitHub repo.
    Returns (DataFrame, sha) where sha is needed to update the file.
    Returns (empty DataFrame, None) if the file does not exist yet.
    """
    url = f"{_API}/repos/{_repo()}/contents/{_path()}"
    resp = _get_with_retry(url, headers=_headers(), timeout=15)

    if resp.status_code == 404:
        return pd.DataFrame(columns=RESULTS_COLUMNS), None

    resp.raise_for_status()
    data = resp.json()
    sha = data["sha"]
    content = base64.b64decode(data["content"]).decode("utf-8")
    df = pd.read_csv(io.StringIO(content))
    return df, sha


def upload_csv(df: pd.DataFrame, sha: str | None) -> None:
    """
    Commit results.csv to the GitHub repo.
    If sha is provided, updates the existing file; otherwise creates it.
    """
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    encoded = base64.b64encode(csv_bytes).decode("utf-8")

    url = f"{_API}/repos/{_repo()}/contents/{_path()}"
    payload = {
        "message": "Update bird count results",
        "content": encoded,
    }
    if sha:
        payload["sha"] = sha

    resp = _put_with_retry(url, headers=_headers(), json=payload, timeout=15)
    resp.raise_for_status()
