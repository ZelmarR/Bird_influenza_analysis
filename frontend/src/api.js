const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

export function isLoggedIn() {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem("token");
}

export async function verifySession() {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      localStorage.removeItem("token");
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Login failed");
  }
  const data = await res.json();
  localStorage.setItem("token", data.access_token);
}

export async function register(email, password, name = "", department = "") {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, department }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Registration failed");
  }
  if (data.access_token) {
    localStorage.setItem("token", data.access_token);
  }
}

export async function fetchLocations() {
  const res = await fetch(`${BASE_URL}/locations`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load locations");
  return res.json();
}

export async function addLocation(name) {
  const res = await fetch(`${BASE_URL}/locations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Failed to add location");
  return data;
}

export async function deleteLocation(name) {
  const res = await fetch(`${BASE_URL}/locations/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Failed to delete location");
  return data;
}

export async function fetchResults(location) {
  const res = await fetch(`${BASE_URL}/results/${location}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load results");
  return res.json();
}

export function wsUrl() {
  return BASE_URL.replace(/^http/, "ws") + "/ws/process";
}

const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB — must match backend CHUNK_SIZE
const UPLOAD_MAX_RETRIES = 8;

async function _postForm(url, form) {
  const res = await fetch(`${BASE_URL}${url}`, { method: "POST", body: form });
  if (res.status === 401) {
    localStorage.removeItem("token");
    throw new Error("Session expired — please log in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

export async function uploadVideo({ file, token, location, filename, threshold, recorded_at }, onProgress) {
  const totalChunks = Math.ceil(file.size / UPLOAD_CHUNK_SIZE);

  // 1. Init — create upload session on server
  const initRes = await fetch(`${BASE_URL}/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, location, filename, total_chunks: totalChunks, file_size: file.size, threshold, recorded_at: recorded_at || "" }),
  });
  if (initRes.status === 401) { localStorage.removeItem("token"); throw new Error("Session expired — please log in again."); }
  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok) throw new Error(initData.detail || "Failed to start upload");
  const { upload_id } = initData;

  // 2. Upload chunks sequentially with per-chunk retry
  for (let i = 0; i < totalChunks; i++) {
    const start = i * UPLOAD_CHUNK_SIZE;
    const blob = file.slice(start, start + UPLOAD_CHUNK_SIZE);

    let uploaded = false;
    let lastErr;
    for (let attempt = 0; attempt < UPLOAD_MAX_RETRIES && !uploaded; attempt++) {
      try {
        const form = new FormData();
        form.append("upload_id", upload_id);
        form.append("chunk_index", String(i));
        form.append("token", token);
        form.append("chunk", blob, filename);
        await _postForm("/upload/chunk", form);
        uploaded = true;
      } catch (err) {
        lastErr = err;
        if (err.message.includes("Session expired")) throw err;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    if (!uploaded) throw lastErr;

    onProgress((i + 1) / totalChunks);
  }

  // 3. Finalize — tell server all chunks are present, start processing job
  const finalForm = new FormData();
  finalForm.append("upload_id", upload_id);
  finalForm.append("token", token);
  return _postForm("/upload/finalize", finalForm);
}

export async function fetchJob(jobId) {
  const res = await fetch(`${BASE_URL}/job/${jobId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Job not found");
  return res.json();
}
