import base64
import io
import os
import time

import pandas as pd
import requests

RESULTS_COLUMNS = [
    "video_name",
    "location",
    "upload_date",
    "unique_flying_birds",
    "max_concurrent_birds",
    "duration_seconds",
    "processing_time",
]

USERS_COLUMNS = ["id", "email", "password_hash", "created_at"]

_API = "https://api.github.com"
_RETRY_STATUSES = {429, 500, 502, 503, 504}
_MAX_RETRIES = 4


def _headers() -> dict:
    token = os.environ["GITHUB_TOKEN"]
    return {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}


def _repo() -> str:
    return os.environ["GITHUB_REPO"]


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


def _fetch_file(path: str) -> tuple[str, str | None]:
    """Return (decoded_content, sha) or ('', None) if file doesn't exist."""
    url = f"{_API}/repos/{_repo()}/contents/{path}"
    resp = _get_with_retry(url, headers=_headers(), timeout=15)
    if resp.status_code == 404:
        return "", None
    resp.raise_for_status()
    data = resp.json()
    content = base64.b64decode(data["content"]).decode("utf-8")
    return content, data["sha"]


def _commit_file(path: str, content_str: str, sha: str | None, message: str) -> None:
    encoded = base64.b64encode(content_str.encode("utf-8")).decode("utf-8")
    url = f"{_API}/repos/{_repo()}/contents/{path}"
    payload: dict = {"message": message, "content": encoded}
    if sha:
        payload["sha"] = sha
    resp = _put_with_retry(url, headers=_headers(), json=payload, timeout=15)
    resp.raise_for_status()


# ── Results (per location) ────────────────────────────────────────────────────

def download_csv(location: str) -> tuple[pd.DataFrame, str | None]:
    path = f"results_{location}.csv"
    content, sha = _fetch_file(path)
    if not content:
        return pd.DataFrame(columns=RESULTS_COLUMNS), None
    return pd.read_csv(io.StringIO(content)), sha


def upload_csv(df: pd.DataFrame, sha: str | None, location: str) -> None:
    path = f"results_{location}.csv"
    _commit_file(path, df.to_csv(index=False), sha, f"Update results for location {location}")


# ── Users ─────────────────────────────────────────────────────────────────────

def download_users() -> tuple[pd.DataFrame, str | None]:
    content, sha = _fetch_file("users.csv")
    if not content:
        return pd.DataFrame(columns=USERS_COLUMNS), None
    return pd.read_csv(io.StringIO(content)), sha


def upload_users(df: pd.DataFrame, sha: str | None) -> None:
    _commit_file("users.csv", df.to_csv(index=False), sha, "Update users")
