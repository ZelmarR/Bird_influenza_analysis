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

export function uploadVideo({ file, token, location, filename, threshold, recorded_at }, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("token", token);
    form.append("location", location);
    form.append("filename", filename);
    form.append("threshold", String(threshold));
    form.append("recorded_at", recorded_at || "");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
      else if (xhr.status === 401) {
        localStorage.removeItem("token");
        reject(new Error("Session expired — please log in again."));
      } else {
        let detail = xhr.responseText;
        try { detail = JSON.parse(xhr.responseText).detail || detail; } catch { /* ignore */ }
        reject(new Error(detail));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(form);
  });
}

export async function fetchJob(jobId) {
  const res = await fetch(`${BASE_URL}/job/${jobId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Job not found");
  return res.json();
}
