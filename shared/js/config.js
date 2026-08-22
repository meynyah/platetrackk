// =========================================
// PlateTrack | API Configuration
// =========================================
// Single source of truth for the backend's URL. Update ONLY this file when
// deploying the backend somewhere other than localhost — every page that
// includes this script (via <script src="shared/js/config.js">) picks up
// the change automatically.

const API_BASE_URL = "https://platetrackk.onrender.com";
// Convenience constant for files that build requests like
// `${API_BASE}/enforcer/violations` instead of `${API_BASE_URL}/api/...`.
const API_BASE = `${API_BASE_URL}/api`;
