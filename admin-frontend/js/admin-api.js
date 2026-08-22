/**
 * PlateTrack Admin — shared API helper.
 *
 * IMPORTANT: set API_BASE_URL to wherever you deploy the backend
 * (backend/server.js). While developing locally with `npm run dev`
 * in /backend, this defaults to http://localhost:5000.
 */
const API_BASE_URL = "http://localhost:5000/api";

const Auth = {
  TOKEN_KEY: "platetrack_admin_token",
  USER_KEY: "platetrack_admin_user",

  saveSession(token, user) {
    localStorage.setItem(Auth.TOKEN_KEY, token);
    localStorage.setItem(Auth.USER_KEY, JSON.stringify(user));
  },
  getToken() {
    return localStorage.getItem(Auth.TOKEN_KEY);
  },
  getUser() {
    const raw = localStorage.getItem(Auth.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  clearSession() {
    localStorage.removeItem(Auth.TOKEN_KEY);
    localStorage.removeItem(Auth.USER_KEY);
  },
  requireAuth() {
    if (!Auth.getToken()) {
     window.location.replace("admin-login.html");
    }
  },
};

/**
 * Wrapper around fetch() that attaches the admin JWT, prefixes the API
 * base URL, and handles JSON parsing + 401 redirects consistently.
 */
async function apiRequest(path, { method = "GET", body = null } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = Auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    Auth.clearSession();
    window.location.replace("admin-login.html");
    return null;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* no JSON body */
  }

  if (!res.ok) {
    throw new Error((data && data.message) || `Request failed (${res.status})`);
  }

  return data;
}

function showToast(message, type = "success") {
  const stack = document.getElementById("toastStack") || (() => {
    const el = document.createElement("div");
    el.id = "toastStack";
    el.className = "toast-stack";
    document.body.appendChild(el);
    return el;
  })();

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
