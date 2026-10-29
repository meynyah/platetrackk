Auth.requireAuth();

/* ----------------------------- Navigation ----------------------------- */

const views = document.querySelectorAll(".view");
const navItems = document.querySelectorAll(".nav-item[data-view]");

function switchView(viewName) {
  // Safety net: if a link points at a view that does not exist (for example a
  // page that was merged into another one), fall back to the Dashboard
  // overview instead of showing an empty screen.
  if (!Array.from(views).some((v) => v.id === `view-${viewName}`)) {
    console.warn(`switchView: unknown view "${viewName}", showing the overview instead.`);
    viewName = "overview";
  }

  views.forEach((v) =>
    v.classList.toggle("active", v.id === `view-${viewName}`)
  );

  navItems.forEach((n) =>
    n.classList.toggle("active", n.dataset.view === viewName)
  );

  // Remember the active view in the URL so a page refresh (or a shared
  // link) lands back on the same screen instead of always bouncing to the
  // Dashboard overview. replaceState (not location.hash=) avoids piling up
  // a browser-history entry for every single tab click.
  history.replaceState(null, "", `#${viewName}`);

  loadViewData(viewName);
  updateDashboardBackButton(viewName);
}

navItems.forEach((item) => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  Auth.clearSession();
  window.location.href = "admin-login.html";
});

/* ------------------------------ Admin chip ----------------------------- */

const admin = Auth.getUser();
if (admin) {
  document.getElementById("adminName").textContent = admin.fullName || admin.email;
  document.getElementById("adminInitial").textContent = (admin.fullName || admin.email || "A").charAt(0).toUpperCase();
}

/* ------------------------------ Data loading ---------------------------- */

function loadViewData(viewName) {
  switch (viewName) {
    case "overview": return loadOverview();
    case "enforcer-performance": return loadEnforcerPerformance();
    case "account-approvals": return loadAccountApprovalsV2();
    case "enforcer-monitor": return loadEnforcerMonitor();
    case "active-duty": return loadActiveDuty();
    case "owner-monitor": return loadOwnerMonitor();
    case "violations": return loadViolations();
    case "appeals": return loadAppeals();
    case "announcements": return loadAnnouncements();
  }
}

function statusChip(status) {
  return `<span class="status-chip status-${status}">${status.replace("_", " ")}</span>`;
}

/* --------------------------- ENFORCER PERFORMANCE ------------------------- */

// The performance ranking has its own page (it used to sit at the bottom of
// the Dashboard, which made "Dashboard" and "Enforcer Performance" in the
// sidebar open the very same screen).
async function loadEnforcerPerformance() {
  try {
    const leaderboard = await apiRequest("/admin/enforcers/leaderboard");
    renderExecutiveLeaderboard(leaderboard);
  } catch (err) {
    const body = document.getElementById("leaderboardBody");
    if (body) {
      body.innerHTML = `<tr><td colspan="6" class="empty-state">Could not load enforcer performance: ${escapeHtml(err.message || "network error")}</td></tr>`;
    }
  }
}

/* --------------------------------- OVERVIEW ------------------------------ */

async function loadOverview() {
  try {
    const stats = await apiRequest("/admin/stats");

    document.getElementById("statGrid").innerHTML = `
      <article class="stat-card stat-blue">
        <div class="stat-card-top">
          <span class="stat-icon">
            <i class="fa-solid fa-user-shield"></i>
          </span>
          <span class="stat-trend trend-neutral">
            Verified
          </span>
        </div>
        <div class="num animated-stat" data-value="${stats.totalEnforcers}">0</div>

        <div class="label">Approved Enforcers</div>
        <div class="stat-footer">
          <span class="trend up">
            <i class="fa-solid fa-arrow-trend-up"></i>
            +${stats.enforcersApprovedToday || 0} Today
          </span>
        </div>
      </article>

      <article class="stat-card stat-amber warn">
        <div class="stat-card-top">
          <span class="stat-icon">
            <i class="fa-solid fa-user-clock"></i>
          </span>
          <span class="stat-trend trend-warning">
            Needs review
          </span>
        </div>
        <div class="num animated-stat" data-value="${stats.pendingEnforcers}">0</div>

        <div class="label">Enforcer Approvals Pending</div>
        <div class="stat-footer">
          <span class="trend waiting">
            <i class="fa-solid fa-clock"></i>
            Awaiting Review
          </span>
        </div>
      </article>

      <article class="stat-card stat-violet">
        <div class="stat-card-top">
          <span class="stat-icon">
            <i class="fa-solid fa-users"></i>
          </span>
          <span class="stat-trend trend-neutral">
            Verified
          </span>
        </div>
        <div class="num animated-stat" data-value="${stats.totalOwners}">0</div>

        <div class="label">Approved Vehicle Owners</div>
        <div class="stat-footer">
          <span class="trend up">
            <i class="fa-solid fa-arrow-trend-up"></i>
            +${stats.ownersApprovedThisWeek || 0} This Week
          </span>
        </div>  
      </article>

  <article class="stat-card stat-orange warn">
    <div class="stat-card-top">
      <span class="stat-icon">
        <i class="fa-solid fa-id-card"></i>
      </span>
      <span class="stat-trend trend-warning">
        Needs review
      </span>
    </div>
    <div class="num animated-stat" data-value="${stats.pendingOwners}">0</div>

    <div class="label">Owner Approvals Pending</div>
    <div class="stat-footer">
      <span class="trend waiting">
        <i class="fa-solid fa-user-clock"></i>
        Pending Approval
      </span>
    </div>
  </article>

  <article class="stat-card stat-red danger">
    <div class="stat-card-top">
      <span class="stat-icon">
        <i class="fa-solid fa-user-large-slash"></i>
      </span>
      <span class="stat-trend trend-danger">
        Monitor
      </span>
    </div>
    <div class="num animated-stat" data-value="${stats.flaggedOwners}">0</div>

    <div class="label">Flagged Owner Accounts</div>
    <div class="stat-footer">
      <span class="trend danger">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Needs Attention
      </span>
    </div>
  </article>

  <article class="stat-card stat-green good">
    <div class="stat-card-top">
      <span class="stat-icon">
        <i class="fa-solid fa-file-circle-check"></i>
      </span>
      <span class="stat-trend trend-success">
        All records
      </span>
    </div>
    <div class="num animated-stat" data-value="${stats.totalViolations}">0</div>

    <div class="label">Total Violation Reports</div>
    <div class="stat-footer">
      <span class="trend good">
        <i class="fa-solid fa-chart-line"></i>
        Updated Live
      </span>
    </div>
  </article>

  <article class="stat-card stat-cyan">
    <div class="stat-card-top">
      <span class="stat-icon">
        <i class="fa-solid fa-calendar-day"></i>
      </span>
      <span class="stat-trend trend-neutral">
        Today
      </span>
    </div>
    <div class="num animated-stat" data-value="${stats.violationsToday}">0</div>

    <div class="label">Reports Filed Today</div>
    <div class="stat-footer">
      <span class="trend info">
        <i class="fa-solid fa-calendar-day"></i>
        Today's Activity
      </span>
    </div>
  </article>

  <article class="stat-card stat-pink warn">
    <div class="stat-card-top">
      <span class="stat-icon">
        <i class="fa-solid fa-scale-balanced"></i>
      </span>
      <span class="stat-trend trend-warning">
        Needs action
      </span>
    </div>
    <div class="num animated-stat" data-value="${stats.pendingAppeals}">0</div>

    <div class="label">Appeals Awaiting Action</div>
    <div class="stat-footer">
      <span class="trend warning">
        <i class="fa-solid fa-scale-balanced"></i>
        Review Needed
      </span>
    </div>
  </article>
`;

animateStatCounters();

    updateSidebarCounts(stats);
    updateExecutiveSummary(stats);
    updateAdminNotificationCenter(stats);

    await loadExecutiveDashboardData();

  } catch (err) {
    console.error("Dashboard overview error:", err);

    showToast(
      err.message || "Failed to load dashboard overview.",
      "error"
    );
  }
}

async function updateSidebarCounts(stats) {

  const pendingEnforcers =
    Number(stats.pendingEnforcers || 0);

  const pendingOwners =
    Number(stats.pendingOwners || 0);

  const pendingAppeals =
    Number(stats.pendingAppeals || 0);

  const totalAccountApprovals =
    pendingEnforcers + pendingOwners;

  setCount(
    "countAccountApprovals",
    totalAccountApprovals
  );

  // Safe support for old IDs while old sections remain
  setCount(
    "countEnforcerPending",
    pendingEnforcers
  );

  setCount(
    "countOwnerPending",
    pendingOwners
  );

  setCount(
    "countAppealsPending",
    pendingAppeals
  );
}

function setCount(id, number) {

  const element =
    document.getElementById(id);

  if (!element) {
    return;
  }

  if (number > 0) {

    element.style.display =
      "inline-flex";

    element.textContent =
      number > 99
        ? "99+"
        : String(number);

  } else {

    element.style.display =
      "none";

    element.textContent = "";
  }
}

document.getElementById("refreshOverview").addEventListener("click", loadOverview);

/* ------------------------------ ENFORCER MONITOR --------------------------- */

let enforcerMonitorCache = [];

function renderEnforcerMonitorTable(list) {
  const body = document.getElementById("enforcerMonitorBody");
  if (!body) return;

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">No matching enforcer accounts.</td></tr>`;
    return;
  }

  body.innerHTML = list.map((e) => `
    <tr>
      <td>${escapeHtml(e.fullName)}</td>
      <td class="mono">${escapeHtml(e.email)}</td>
      <td class="mono">${escapeHtml(e.badgeNumber)}</td>
      <td>${escapeHtml(e.station || "—")}</td>
      <td>${statusChip(e.status)}</td>
      <td>${dutyChip(e.onDuty)}</td>
    </tr>
  `).join("");
}

function dutyChip(onDuty) {
  if (onDuty) {
    return `<span class="status-chip status-onduty"><i class="fa-solid fa-circle" style="font-size:7px;"></i> On Duty</span>`;
  }
  return `<span class="status-chip status-offduty">Off Duty</span>`;
}

function filterEnforcerMonitor() {
  const input = document.getElementById("enforcerMonitorSearch");
  const query = (input?.value || "").trim().toLowerCase();

  if (!query) {
    renderEnforcerMonitorTable(enforcerMonitorCache);
    return;
  }

  const filtered = enforcerMonitorCache.filter((e) => {
    return [e.fullName, e.email, e.badgeNumber, e.station]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(query));
  });

  renderEnforcerMonitorTable(filtered);
}

document.getElementById("enforcerMonitorSearch")
  ?.addEventListener("input", filterEnforcerMonitor);

async function loadEnforcerMonitor() {
  const body = document.getElementById("enforcerMonitorBody");
  try {
    const list = await apiRequest("/admin/enforcers");
    enforcerMonitorCache = Array.isArray(list) ? list : [];
    filterEnforcerMonitor();
  } catch (err) {
    if (body) body.innerHTML = `<tr><td colspan="6" class="empty-state">Failed to load enforcer accounts.</td></tr>`;
    showToast(err.message, "error");
  }
}

/* ------------------------------- ACTIVE DUTY ------------------------------ */

async function loadActiveDuty() {
  const body = document.getElementById("activeDutyBody");
  const countLabel = document.getElementById("activeDutyCount");

  try {
    const list = await apiRequest("/admin/enforcers");
    const onDuty = (Array.isArray(list) ? list : []).filter((e) => e.onDuty);

    if (countLabel) {
      countLabel.textContent = `${onDuty.length} On Duty`;
    }

    if (!body) return;

    if (!onDuty.length) {
      body.innerHTML = `<tr><td colspan="4" class="empty-state">No enforcers are currently on duty.</td></tr>`;
      return;
    }

    // Most recently-started shift first, so a fresh check-in surfaces at
    // the top rather than getting buried among enforcers who have been
    // on duty since earlier in the day.
    onDuty.sort((a, b) => new Date(b.dutyChangedAt || 0) - new Date(a.dutyChangedAt || 0));

    body.innerHTML = onDuty.map((e) => `
      <tr>
        <td>${escapeHtml(e.fullName)}</td>
        <td class="mono">${escapeHtml(e.badgeNumber)}</td>
        <td>${escapeHtml(e.station || "—")}</td>
        <td>${e.dutyChangedAt ? new Date(e.dutyChangedAt).toLocaleString("en-PH", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) : "—"}</td>
      </tr>
    `).join("");

  } catch (err) {
    if (body) body.innerHTML = `<tr><td colspan="4" class="empty-state">Failed to load active duty enforcers.</td></tr>`;
    showToast(err.message, "error");
  }
}

/* ------------------------------- OWNER MONITOR ----------------------------- */

let ownerMonitorCache = [];

function renderOwnerMonitorTable(list) {
  const body = document.getElementById("ownerMonitorBody");
  if (!body) return;

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state">No matching vehicle-owner accounts.</td></tr>`;
    return;
  }

  body.innerHTML = list.map((o) => `
    <tr>
      <td>${escapeHtml(o.fullName)}</td>
      <td class="mono">${escapeHtml(o.email)}</td>
      <td><span class="plate-chip">${escapeHtml(o.plateNumber)}</span></td>
      <td>${statusChip(o.status)}</td>
      <td>
        <div class="row-actions">
          ${o.status === "flagged"
            ? `<button class="btn btn-outline btn-sm" onclick="unflagOwner('${o._id}')">Unflag</button>`
            : `<button class="btn btn-outline btn-sm" onclick="flagOwner('${o._id}')">Flag as suspicious</button>`
          }
        </div>
      </td>
    </tr>
  `).join("");
}

function filterOwnerMonitor() {
  const input = document.getElementById("ownerMonitorSearch");
  const query = (input?.value || "").trim().toLowerCase();

  if (!query) {
    renderOwnerMonitorTable(ownerMonitorCache);
    return;
  }

  const filtered = ownerMonitorCache.filter((o) => {
    return [o.fullName, o.email, o.plateNumber]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(query));
  });

  renderOwnerMonitorTable(filtered);
}

document.getElementById("ownerMonitorSearch")
  ?.addEventListener("input", filterOwnerMonitor);

async function loadOwnerMonitor() {
  const body = document.getElementById("ownerMonitorBody");
  try {
    const list = await apiRequest("/admin/owners");
    ownerMonitorCache = Array.isArray(list) ? list : [];
    filterOwnerMonitor();
  } catch (err) {
    if (body) body.innerHTML = `<tr><td colspan="5" class="empty-state">Failed to load vehicle-owner accounts.</td></tr>`;
    showToast(err.message, "error");
  }
}

function flagOwner(id) {
  openReasonModal({
    title: "Flag account for monitoring",
    sub: "This marks the account as suspicious for closer review. It does not block sign-in.",
    onConfirm: async (reason) => {
      try {
        await apiRequest(`/admin/owners/${id}/flag`, { method: "PATCH", body: { reason } });
        showToast("Owner account flagged.");
        loadOwnerMonitor();
      } catch (err) {
        showToast(err.message, "error");
      }
    },
  });
}

async function unflagOwner(id) {
  try {
    await apiRequest(`/admin/owners/${id}/unflag`, { method: "PATCH" });
    showToast("Owner account unflagged.");
    loadOwnerMonitor();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* --------------------------------- VIOLATIONS ------------------------------- */

/* =========================================================
   VIOLATION REPORTS V2 — FULL LOGIC
========================================================= */

let violationsCache = [];
let filteredViolationsCache = [];
let violationCurrentPage = 1;
let violationPageSize = 10;
let violationSortField = "date";
let violationSortDirection = "desc";

const violationSearchInput =
  document.getElementById("violationSearchInput");
const violationTypeFilter =
  document.getElementById("violationTypeFilter");
const violationStatusFilter =
  document.getElementById("violationStatusFilter");
const violationDateText =
  document.getElementById("violationDateText");
const violationDateFilter =
  document.getElementById("violationDateFilter");
const openViolationDatePicker =
  document.getElementById("openViolationDatePicker");
const violationDateError =
  document.getElementById("violationDateError");
const clearViolationFilters =
  document.getElementById("clearViolationFilters");
const refreshViolationReports =
  document.getElementById("refreshViolationReports");
const exportViolationReports =
  document.getElementById("exportViolationReports");
const violationResultsSummary =
  document.getElementById("violationResultsSummary");
const violationRecordCount =
  document.getElementById("violationRecordCount");
const violationsBody =
  document.getElementById("violationsBody");
const violationPageSizeSelect =
  document.getElementById("violationPageSize");
const violationPaginationInfo =
  document.getElementById("violationPaginationInfo");
const violationPreviousPage =
  document.getElementById("violationPreviousPage");
const violationNextPage =
  document.getElementById("violationNextPage");
const violationPageNumbers =
  document.getElementById("violationPageNumbers");
const violationSortButtons =
  document.querySelectorAll(".violation-sort-button");

/* =========================================================
   LOAD
========================================================= */

async function loadViolations() {

  if (violationResultsSummary) {
    violationResultsSummary.textContent =
      "Loading violation reports...";
  }

  if (violationsBody) {
    violationsBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          Loading violation reports…
        </td>
      </tr>
    `;
  }

  try {

    // The backend now paginates this endpoint (100 records max per
    // request) instead of returning every violation report at once --
    // fetch a few pages in sequence to build a comfortably large working
    // set for the existing search/filter UI below, without ever pulling
    // an unbounded, ever-growing number of records into the browser.
    const MAX_BATCHES = 5;
    const BATCH_SIZE = 100;
    let combined = [];

    for (let page = 1; page <= MAX_BATCHES; page++) {

      const result = await apiRequest(`/admin/violations?page=${page}&limit=${BATCH_SIZE}`);
      const batch = Array.isArray(result?.violations) ? result.violations : [];

      combined = combined.concat(batch);

      const totalPages = result?.totalPages || 1;
      if (page >= totalPages) {
        break;
      }

    }

    violationsCache = combined;

    violationCurrentPage = 1;

    applyViolationFilters();

  } catch (err) {

    if (violationResultsSummary) {
      violationResultsSummary.textContent =
        "Failed to load violation reports.";
    }

    if (violationsBody) {
      violationsBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            Unable to load violation reports.
          </td>
        </tr>
      `;
    }

    showToast(
      err.message || "Failed to load violation reports.",
      "error"
    );
  }
}

/* =========================================================
   DATE HELPERS (DD/MM/YYYY <-> ISO)
========================================================= */

function parseDisplayDate(value) {

  const match =
    String(value || "").trim()
      .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;

  const [, dd, mm, yyyy] = match;

  const date =
    new Date(`${yyyy}-${mm}-${dd}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isoToDisplayDate(isoValue) {

  if (!isoValue) return "";

  const [yyyy, mm, dd] = isoValue.split("-");

  return `${dd}/${mm}/${yyyy}`;
}

/* =========================================================
   FILTER + SORT + PAGINATE
========================================================= */

function applyViolationFilters() {

  const query =
    violationSearchInput
      ? violationSearchInput.value.trim().toLowerCase()
      : "";

  const typeValue =
    violationTypeFilter ? violationTypeFilter.value : "";

  const statusValue =
    violationStatusFilter ? violationStatusFilter.value : "";

  const filterDate =
    parseDisplayDate(violationDateText?.value);

  filteredViolationsCache =
    violationsCache.filter((v) => {

      const searchableText = [
        v.plateNumber,
        v.violationType,
        v.enforcer?.fullName,
        v.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchableText.includes(query);

      const matchesType =
        !typeValue || v.violationType === typeValue;

      const matchesStatus =
        !statusValue || v.status === statusValue;

      let matchesDate = true;

      if (filterDate) {

        const recordDate =
          new Date(v.dateTime || v.createdAt);

        matchesDate =
          !Number.isNaN(recordDate.getTime()) &&
          recordDate.getFullYear() === filterDate.getFullYear() &&
          recordDate.getMonth() === filterDate.getMonth() &&
          recordDate.getDate() === filterDate.getDate();
      }

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesDate
      );
    });

  sortViolations();

  violationCurrentPage = 1;

  renderViolationsPage();
}

function sortViolations() {

  const direction =
    violationSortDirection === "asc" ? 1 : -1;

  filteredViolationsCache.sort((a, b) => {

    let valueA, valueB;

    switch (violationSortField) {

      case "plateNumber":
        valueA = a.plateNumber || "";
        valueB = b.plateNumber || "";
        return direction * valueA.localeCompare(valueB);

      case "violationType":
        valueA = a.violationType || "";
        valueB = b.violationType || "";
        return direction * valueA.localeCompare(valueB);

      case "enforcer":
        valueA = a.enforcer?.fullName || "";
        valueB = b.enforcer?.fullName || "";
        return direction * valueA.localeCompare(valueB);

      case "location":
        valueA = a.location || "";
        valueB = b.location || "";
        return direction * valueA.localeCompare(valueB);

      case "status":
        valueA = a.status || "";
        valueB = b.status || "";
        return direction * valueA.localeCompare(valueB);

      case "date":
      default:
        valueA = new Date(a.dateTime || a.createdAt || 0).getTime();
        valueB = new Date(b.dateTime || b.createdAt || 0).getTime();
        return direction * (valueA - valueB);
    }
  });
}

/* =========================================================
   RENDER TABLE + SUMMARY + PAGINATION
========================================================= */

function renderViolationsPage() {

  const total = filteredViolationsCache.length;

  const totalPages =
    Math.max(1, Math.ceil(total / violationPageSize));

  if (violationCurrentPage > totalPages) {
    violationCurrentPage = totalPages;
  }

  const startIndex =
    (violationCurrentPage - 1) * violationPageSize;

  const pageItems =
    filteredViolationsCache.slice(
      startIndex,
      startIndex + violationPageSize
    );

  if (violationResultsSummary) {

    violationResultsSummary.textContent =
      total === violationsCache.length
        ? "Showing all violation reports."
        : `Showing ${total} of ${violationsCache.length} violation reports.`;
  }

  if (violationRecordCount) {

    violationRecordCount.textContent =
      `${total} Record${total === 1 ? "" : "s"}`;
  }

  if (!violationsBody) return;

  if (!pageItems.length) {

    violationsBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          No violation reports match your filters.
        </td>
      </tr>
    `;

  } else {

    violationsBody.innerHTML =
      pageItems.map((v) => `
        <tr>
          <td><span class="plate-chip">${escapeHtml(v.plateNumber)}</span></td>
          <td>${escapeHtml(v.violationType)}</td>
          <td>${v.enforcer ? escapeHtml(v.enforcer.fullName) : "—"}</td>
          <td>${escapeHtml(v.location || "—")}</td>
          <td class="text-muted">${formatDate(v.dateTime || v.createdAt)}</td>
          <td>${statusChip(v.status)}</td>
          <td>
            <div class="row-actions">
              <button
                type="button"
                class="btn btn-outline btn-sm"
                onclick="viewViolationDetailsV2('${v._id}')"
              >
                View
              </button>
            </div>
          </td>
        </tr>
      `).join("");
  }

  renderViolationPagination(totalPages, total);
}

function renderViolationPagination(totalPages, total) {

  if (violationPaginationInfo) {

    violationPaginationInfo.textContent =
      total === 0
        ? "Page 0 of 0"
        : `Page ${violationCurrentPage} of ${totalPages}`;
  }

  if (violationPreviousPage) {
    violationPreviousPage.disabled =
      violationCurrentPage <= 1;
  }

  if (violationNextPage) {
    violationNextPage.disabled =
      violationCurrentPage >= totalPages;
  }

  if (!violationPageNumbers) return;

  const maxButtons = 5;

  let startPage =
    Math.max(1, violationCurrentPage - Math.floor(maxButtons / 2));

  let endPage =
    Math.min(totalPages, startPage + maxButtons - 1);

  startPage = Math.max(1, endPage - maxButtons + 1);

  let buttonsHtml = "";

  for (let page = startPage; page <= endPage; page++) {

    buttonsHtml += `
      <button
        type="button"
        class="${page === violationCurrentPage ? "active" : ""}"
        onclick="goToViolationPage(${page})"
      >
        ${page}
      </button>
    `;
  }

  violationPageNumbers.innerHTML = buttonsHtml;
}

function goToViolationPage(page) {
  violationCurrentPage = page;
  renderViolationsPage();
}

window.goToViolationPage = goToViolationPage;

/* =========================================================
   EVENT LISTENERS
========================================================= */

violationSearchInput?.addEventListener(
  "input",
  applyViolationFilters
);

violationTypeFilter?.addEventListener(
  "change",
  applyViolationFilters
);

violationStatusFilter?.addEventListener(
  "change",
  applyViolationFilters
);

violationDateText?.addEventListener("input", () => {

  // Auto-insert the "/" separators as the person types digits, so typing
  // "16082026" becomes "16/08/2026" without them having to type the
  // slashes themselves.
  const digitsOnly =
    violationDateText.value.replace(/\D/g, "").slice(0, 8);

  let formatted = digitsOnly;

  if (digitsOnly.length > 4) {
    formatted =
      `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
  } else if (digitsOnly.length > 2) {
    formatted =
      `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}`;
  }

  violationDateText.value = formatted;

  const value = violationDateText.value.trim();

  if (!value) {
    if (violationDateError) violationDateError.textContent = "";
    applyViolationFilters();
    return;
  }

  // Don't flash a "wrong format" error while the person is still in the
  // middle of typing (e.g. after "16/08") — only validate once they've
  // typed a full DD/MM/YYYY-length date.
  if (value.length < 10) {
    if (violationDateError) violationDateError.textContent = "";
    return;
  }

  const parsed = parseDisplayDate(value);

  if (!parsed) {
    if (violationDateError) {
      violationDateError.textContent =
        "Use DD/MM/YYYY format.";
    }
    return;
  }

  if (violationDateError) violationDateError.textContent = "";

  // Keep the hidden native date input in sync too, so the calendar (once
  // opened) highlights the date that was typed.
  if (violationDateFilter) {
    const [dd, mm, yyyy] = value.split("/");
    violationDateFilter.value = `${yyyy}-${mm}-${dd}`;
  }

  applyViolationFilters();
});

function openViolationCalendar() {

  if (!violationDateFilter?.showPicker) {
    return;
  }

  try {
    violationDateFilter.showPicker();
  } catch (error) {
    // showPicker() can reject if it's already open or the field isn't
    // ready yet — safe to ignore, the text field still works on its own.
  }

}

// Typing a date and picking one from the calendar are two ways to fill in
// the same field, so open the calendar as soon as the person focuses the
// text field to type, not only when they click the calendar icon.
violationDateText?.addEventListener("focus", openViolationCalendar);

openViolationDatePicker?.addEventListener("click", () => {

  if (violationDateFilter?.showPicker) {
    violationDateFilter.showPicker();
  } else {
    violationDateFilter?.click();
  }
});

violationDateFilter?.addEventListener("change", () => {

  if (violationDateText) {
    violationDateText.value =
      isoToDisplayDate(violationDateFilter.value);
  }

  if (violationDateError) violationDateError.textContent = "";

  applyViolationFilters();
});

clearViolationFilters?.addEventListener("click", () => {

  if (violationSearchInput) violationSearchInput.value = "";
  if (violationTypeFilter) violationTypeFilter.value = "";
  if (violationStatusFilter) violationStatusFilter.value = "";
  if (violationDateText) violationDateText.value = "";
  if (violationDateFilter) violationDateFilter.value = "";
  if (violationDateError) violationDateError.textContent = "";

  applyViolationFilters();
});

refreshViolationReports?.addEventListener(
  "click",
  loadViolations
);

exportViolationReports?.addEventListener("click", () => {

  if (!filteredViolationsCache.length) {
    showToast("No records to export.", "error");
    return;
  }

  const headers = [
    "Plate Number", "Violation", "Enforcer",
    "Location", "Date/Time", "Status"
  ];

  const rows = filteredViolationsCache.map((v) => [
    v.plateNumber || "",
    v.violationType || "",
    v.enforcer?.fullName || "",
    v.location || "",
    formatDate(v.dateTime || v.createdAt),
    v.status || ""
  ]);

  const csvContent =
    [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `violation-reports-${Date.now()}.csv`;
  link.click();
});

violationSortButtons.forEach((button) => {

  button.addEventListener("click", () => {

    const field = button.dataset.violationSort;

    if (violationSortField === field) {

      violationSortDirection =
        violationSortDirection === "asc" ? "desc" : "asc";

    } else {

      violationSortField = field;
      violationSortDirection = "asc";
    }

    violationSortButtons.forEach((btn) => {

      btn.classList.remove("active");

      const icon = btn.querySelector("i");
      if (icon) icon.className = "fa-solid fa-sort";
    });

    button.classList.add("active");

    const activeIcon = button.querySelector("i");
    if (activeIcon) {
      activeIcon.className =
        violationSortDirection === "asc"
          ? "fa-solid fa-arrow-up"
          : "fa-solid fa-arrow-down";
    }

    sortViolations();
    renderViolationsPage();
  });
});

violationPageSizeSelect?.addEventListener("change", () => {

  violationPageSize =
    Number(violationPageSizeSelect.value) || 10;

  violationCurrentPage = 1;

  renderViolationsPage();
});

violationPreviousPage?.addEventListener("click", () => {

  if (violationCurrentPage > 1) {
    violationCurrentPage -= 1;
    renderViolationsPage();
  }
});

violationNextPage?.addEventListener("click", () => {

  const totalPages =
    Math.max(1, Math.ceil(filteredViolationsCache.length / violationPageSize));

  if (violationCurrentPage < totalPages) {
    violationCurrentPage += 1;
    renderViolationsPage();
  }
});

/* =========================================================
   VIEW DETAILS MODAL
========================================================= */

function viewViolationDetailsV2(violationId) {

    const violation =
        violationsCache.find(
            (v) => v._id === violationId
        );

    if (!violation) {
        return;
    }

    const modal =
        document.getElementById(
            "adminViolationDetailsModal"
        );

    if (!modal) {
        return;
    }


    /* =====================================================
       BASIC DETAILS
       ===================================================== */

    const recordId =
        document.getElementById(
            "adminViolationRecordId"
        );

    const plate =
        document.getElementById(
            "adminViolationPlate"
        );

    const type =
        document.getElementById(
            "adminViolationType"
        );

    const vehicle =
        document.getElementById(
            "adminViolationVehicle"
        );

    const color =
        document.getElementById(
            "adminViolationColor"
        );

    const location =
        document.getElementById(
            "adminViolationLocation"
        );

    const date =
        document.getElementById(
            "adminViolationDate"
        );


    if (recordId) {
        recordId.textContent =
            violation._id || "—";
    }

    if (plate) {
        plate.textContent =
            violation.plateNumber || "—";
    }

    if (type) {
        type.textContent =
            violation.violationType || "—";
    }

    if (vehicle) {
        vehicle.textContent =
            violation.vehicleType || "—";
    }

    if (color) {
        color.textContent =
            violation.vehicleColor || "—";
    }

    if (location) {
        location.textContent =
            violation.location || "—";
    }

    if (date) {
        date.textContent =
            formatDate(
                violation.dateTime ||
                violation.createdAt
            );
    }


    /* =====================================================
       EVIDENCE DATE
       ===================================================== */

    const evidenceDate =
        document.getElementById(
            "adminEvidenceDate"
        );

    if (evidenceDate) {

        evidenceDate.innerHTML = `
            <i class="fa-regular fa-clock"></i>
            ${escapeHtml(
                formatDate(
                    violation.dateTime ||
                    violation.createdAt
                )
            )}
        `;

    }


    /* =====================================================
       ENFORCER
       ===================================================== */

    const enforcerName =
        violation.enforcer?.fullName ||
        "Unknown Enforcer";

    const enforcerBadge =
        violation.enforcer?.badgeNumber ||
        "—";

    const enforcer =
        document.getElementById(
            "adminViolationEnforcer"
        );

    const badge =
        document.getElementById(
            "adminViolationBadge"
        );

    const enforcerInitial =
        document.getElementById(
            "adminViolationEnforcerInitial"
        );


    if (enforcer) {
        enforcer.textContent =
            enforcerName;
    }

    if (badge) {
        badge.textContent =
            enforcerBadge;
    }

    if (enforcerInitial) {

        enforcerInitial.textContent =
            enforcerName
                .trim()
                .charAt(0)
                .toUpperCase() || "E";

    }


    /* =====================================================
       REGISTERED OWNER
       ===================================================== */

    const ownerName =
        violation.owner?.fullName ||
        "No registered owner";

    const ownerEmail =
        violation.owner?.email ||
        "—";

    const owner =
        document.getElementById(
            "adminViolationOwner"
        );

    const ownerEmailElement =
        document.getElementById(
            "adminViolationOwnerEmail"
        );

    const ownerInitial =
        document.getElementById(
            "adminViolationOwnerInitial"
        );


    if (owner) {
        owner.textContent =
            ownerName;
    }

    if (ownerEmailElement) {
        ownerEmailElement.textContent =
            ownerEmail;
    }

    if (ownerInitial) {

        ownerInitial.textContent =
            ownerName !== "No registered owner"
                ? ownerName
                    .trim()
                    .charAt(0)
                    .toUpperCase()
                : "O";

    }


    /* =====================================================
       OFFICER NOTES
       ===================================================== */

    const notes =
        document.getElementById(
            "adminViolationNotes"
        );

    if (notes) {

        notes.textContent =
            violation.notes ||
            "No additional remarks.";

    }


    /* =====================================================
       STATUS
       ===================================================== */

    const status =
        String(
            violation.status ||
            "submitted"
        ).toLowerCase();

    const statusText =
        document.getElementById(
            "adminViolationStatusText"
        );

    const statusBadge =
        document.getElementById(
            "adminViolationStatus"
        );

    const statusIcon =
        document.getElementById(
            "adminViolationStatusIcon"
        );


    const statusLabels = {

        submitted: "Pending",

        under_review: "Under Review",

        approved: "Approved",

        denied: "Denied",

        pending: "Pending"

    };


    const statusIcons = {

        submitted:
            "fa-solid fa-clock",

        pending:
            "fa-solid fa-clock",

        under_review:
            "fa-solid fa-magnifying-glass",

        approved:
            "fa-solid fa-circle-check",

        denied:
            "fa-solid fa-circle-xmark"

    };


    if (statusText) {

        statusText.textContent =
            statusLabels[status] ||
            getAppealStatusLabel(status) ||
            status;

    }


    if (statusBadge) {

        statusBadge.classList.remove(
            "status-pending",
            "status-approved",
            "status-denied",
            "status-under-review"
        );


        if (
            status === "approved"
        ) {

            statusBadge.classList.add(
                "status-approved"
            );

        } else if (
            status === "denied"
        ) {

            statusBadge.classList.add(
                "status-denied"
            );

        } else if (
            status === "under_review"
        ) {

            statusBadge.classList.add(
                "status-under-review"
            );

        } else {

            statusBadge.classList.add(
                "status-pending"
            );

        }

    }


    if (statusIcon) {

        statusIcon.className =
            statusIcons[status] ||
            "fa-solid fa-circle-info";

    }


    /* =====================================================
       VEHICLE EVIDENCE IMAGE
       ===================================================== */

    const imageContainer =
        document.getElementById(
            "adminViolationImage"
        );


    if (imageContainer) {

        if (violation.photoUrl) {

            imageContainer.innerHTML = `
                <img
                    src="${escapeHtml(
                        violation.photoUrl
                    )}"
                    alt="Vehicle evidence"
                    loading="eager"
                    onclick="openEvidenceLightboxFromAdmin(
                        '${escapeHtml(
                            violation.photoUrl
                        )}',
                        '${escapeHtml(
                            violation.plateNumber || "—"
                        )}'
                    "
                >
            `;

        } else {

            imageContainer.innerHTML = `
                <div class="premium-no-image">

                    <i class="fa-solid fa-camera"></i>

                    <strong>
                        No captured image
                    </strong>

                    <span>
                        No evidence photo was attached.
                    </span>

                </div>
            `;

        }

    }


    /* =====================================================
       OPEN MODAL
       ===================================================== */

    modal.classList.add("show");

}

function closeAdminViolationDetails() {

  document
    .getElementById("adminViolationDetailsModal")
    ?.classList.remove("show");
}

window.viewViolationDetailsV2 = viewViolationDetailsV2;
window.closeAdminViolationDetails = closeAdminViolationDetails;

/* ---------------------------------- APPEALS --------------------------------- */

/* =========================================================
   APPEALS V2
========================================================= */

const DEFAULT_APPEAL_FEEDBACK =
  "Your appeal is under review. Please proceed to the LTO Antipolo Station to clarify the issue and bring your Driver's License and OR/CR for verification.";

const appealsCardGrid =
  document.getElementById("appealsCardGrid");

const appealsSearchInput =
  document.getElementById("appealsSearchInput");

const appealsPendingTotal =
  document.getElementById("appealsPendingTotal");

const refreshAppealsV2 =
  document.getElementById("refreshAppealsV2");

const appealFilterButtons =
  document.querySelectorAll("[data-appeal-filter]");

let appealsCache = [];
let activeAppealFilter = "all";

/* =========================================================
   LOAD APPEALS
========================================================= */

async function loadAppeals() {

  if (!appealsCardGrid) {
    return;
  }

  setAppealsLoading();

  try {

    const result =
      await apiRequest("/admin/appeals");

    appealsCache =
      Array.isArray(result)
        ? result
        : [];

    updateAppealsPendingCount();

    applyAppealsFilters();

  } catch (error) {

    console.error(
      "Appeals loading error:",
      error
    );

    setAppealsEmpty(
      "Unable to load appeals",
      error.message ||
      "Please refresh the page and try again."
    );

    showToast(
      error.message ||
      "Failed to load vehicle-owner appeals.",
      "error"
    );
  }
}

/* =========================================================
   LOADING / EMPTY STATE
========================================================= */

function setAppealsLoading() {

  if (!appealsCardGrid) {
    return;
  }

  appealsCardGrid.innerHTML = `
    <div class="appeals-loading-state">

      <i class="fa-solid fa-spinner fa-spin"></i>

      <strong>
        Loading vehicle-owner appeals...
      </strong>

    </div>
  `;
}

function setAppealsEmpty(
  title,
  message
) {

  if (!appealsCardGrid) {
    return;
  }

  appealsCardGrid.innerHTML = `
    <div class="appeals-empty-state">

      <i class="fa-regular fa-folder-open"></i>

      <strong>
        ${escapeHtml(title)}
      </strong>

      <span>
        ${escapeHtml(message)}
      </span>

    </div>
  `;
}

/* =========================================================
   PENDING COUNT
========================================================= */

function updateAppealsPendingCount() {

  const pendingCount =
    appealsCache.filter((appeal) => {

      return (
        appeal.status === "submitted" ||
        appeal.status === "under_review"
      );
    }).length;

  if (appealsPendingTotal) {

    appealsPendingTotal.textContent =
      `${pendingCount} pending`;
  }

  setCount(
    "countAppealsPending",
    pendingCount
  );
}

/* =========================================================
   SEARCH AND FILTER
========================================================= */

function applyAppealsFilters() {

  const query =
    appealsSearchInput
      ? appealsSearchInput.value
          .trim()
          .toLowerCase()
      : "";

  const filteredAppeals =
    appealsCache.filter((appeal) => {

      const matchesStatus =
        activeAppealFilter === "all" ||
        appeal.status === activeAppealFilter;

      const searchableText = [

        appeal.owner?.fullName,
        appeal.owner?.email,

        appeal.violation?.plateNumber,
        appeal.violation?.violationType,

        appeal.reason,
        appeal.supportingDetails,
        appeal.feedback,
        appeal.status

      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        searchableText.includes(query);

      return (
        matchesStatus &&
        matchesSearch
      );
    });

  renderAppealsV2(filteredAppeals);
}

appealsSearchInput?.addEventListener(
  "input",
  applyAppealsFilters
);

appealFilterButtons.forEach((button) => {

  button.addEventListener("click", () => {

    appealFilterButtons.forEach(
      (item) => {

        item.classList.remove("active");
      }
    );

    button.classList.add("active");

    activeAppealFilter =
      button.dataset.appealFilter ||
      "all";

    applyAppealsFilters();
  });
});

/* =========================================================
   STATUS HELPERS
========================================================= */

function getAppealStatusLabel(status) {

  const labels = {

    submitted:
      "Submitted",

    under_review:
      "Under Review",

    approved:
      "Approved",

    denied:
      "Denied"

  };

  return labels[status] || status || "Unknown";
}

function getAppealStatusIcon(status) {

  const icons = {

    submitted:
      "fa-solid fa-clock",

    under_review:
      "fa-solid fa-magnifying-glass",

    approved:
      "fa-solid fa-circle-check",

    denied:
      "fa-solid fa-circle-xmark"

  };

  return (
    icons[status] ||
    "fa-solid fa-circle-info"
  );
}

function getOwnerInitial(name) {

  const normalizedName =
    String(name || "").trim();

  return normalizedName
    ? normalizedName
        .charAt(0)
        .toUpperCase()
    : "O";
}

/* =========================================================
   RENDER APPEAL CARDS
========================================================= */

function renderAppealsV2(appeals) {

  if (!appealsCardGrid) {
    return;
  }

  if (!appeals.length) {

    setAppealsEmpty(
      "No matching appeals",
      "There are no appeals matching the selected filter or search."
    );

    return;
  }

  appealsCardGrid.innerHTML =
    appeals.map((appeal) => {

      const ownerName =
        appeal.owner?.fullName ||
        "Vehicle Owner";

      const ownerEmail =
        appeal.owner?.email ||
        "No email available";

      const plateNumber =
        appeal.violation?.plateNumber ||
        "—";

      const violationType =
        appeal.violation?.violationType ||
        "Unknown violation";

      const submittedDate =
        appeal.createdAt
          ? formatDate(appeal.createdAt)
          : "—";

      const status =
        appeal.status ||
        "submitted";

      const isOpen =
        status === "submitted" ||
        status === "under_review";

      const feedbackValue =
        appeal.feedback ||
        DEFAULT_APPEAL_FEEDBACK;

      return `
        <article class="appeal-case-card">

          <div class="appeal-card-top">

            <div class="appeal-owner-avatar">

              ${escapeHtml(
                getOwnerInitial(ownerName)
              )}

            </div>

            <div class="appeal-card-heading">

              <h3>
                ${escapeHtml(ownerName)}
              </h3>

              <p>
                ${escapeHtml(ownerEmail)}
              </p>

            </div>

            <span
              class="appeal-status-badge
              appeal-status-${escapeHtml(status)}"
            >

              <i class="${getAppealStatusIcon(status)}"></i>

              ${escapeHtml(
                getAppealStatusLabel(status)
              )}

            </span>

          </div>

          <div class="appeal-case-meta">

            <div class="appeal-meta-item">

              <span>
                Plate Number
              </span>

              <strong>

                <span class="plate-chip">

                  ${escapeHtml(plateNumber)}

                </span>

              </strong>

            </div>

            <div class="appeal-meta-item">

              <span>
                Violation
              </span>

              <strong>
                ${escapeHtml(violationType)}
              </strong>

            </div>

            <div class="appeal-meta-item">

              <span>
                Submitted
              </span>

              <strong>
                ${escapeHtml(submittedDate)}
              </strong>

            </div>

            <div class="appeal-meta-item">

              <span>
                Appeal Status
              </span>

              <strong>
                ${escapeHtml(
                  getAppealStatusLabel(status)
                )}
              </strong>

            </div>

          </div>

          <div class="appeal-reason-box">

            <span>
              Owner's Appeal Reason
            </span>

            <p>
              ${escapeHtml(
                appeal.reason ||
                "No appeal reason was provided."
              )}
            </p>

          </div>

          <div class="appeal-reason-box">

            <span>
              Owner's Explanation
            </span>

            <p>
              ${escapeHtml(
                appeal.supportingDetails ||
                "No additional explanation was provided."
              )}
            </p>

          </div>

          <div class="appeal-feedback-editor">

            <label
              for="appealFeedback-${appeal._id}"
            >

              Editable Administrator Feedback

              <span>
                Portal notification + email
              </span>

            </label>

            <textarea
              class="appeal-feedback-textarea"
              id="appealFeedback-${appeal._id}"
              ${isOpen ? "" : "disabled"}
            >${escapeHtml(feedbackValue)}</textarea>

            <div class="appeal-delivery-note">

              <i class="fa-solid fa-circle-check"></i>

              This message will be delivered to the
              owner portal notification center and
              registered email address.

            </div>

          </div>

          <div class="appeal-card-actions">

            ${
              isOpen
                ? `
                  <button
                    type="button"
                    class="appeal-send-feedback-button"
                    onclick="sendAppealFeedbackV2('${appeal._id}')"
                  >

                    <i class="fa-solid fa-paper-plane"></i>

                    Ipadala ang Feedback

                  </button>

                  <button
                    type="button"
                    class="appeal-decision-button appeal-deny-button"
                    onclick="resolveAppealV2('${appeal._id}', 'denied')"
                  >

                    <i class="fa-solid fa-xmark"></i>

                    Deny

                  </button>

                  <button
                    type="button"
                    class="appeal-decision-button appeal-approve-button"
                    onclick="resolveAppealV2('${appeal._id}', 'approved')"
                  >

                    <i class="fa-solid fa-check"></i>

                    Approve

                  </button>
                `
                : `
                  <div class="appeal-closed-note">

                    <i class="fa-solid fa-lock"></i>

                    This appeal has already been resolved.

                  </div>
                `
            }

          </div>

        </article>
      `;

    }).join("");
}

/* =========================================================
   SEND UNDER-REVIEW FEEDBACK
========================================================= */

async function sendAppealFeedbackV2(
  appealId
) {

  const feedbackInput =
    document.getElementById(
      `appealFeedback-${appealId}`
    );

  const feedback =
    feedbackInput
      ? feedbackInput.value.trim()
      : "";

  if (!feedback) {

    showToast(
      "Please enter feedback before sending.",
      "error"
    );

    feedbackInput?.focus();

    return;
  }

  const button =
    document.querySelector(
      `button[onclick="sendAppealFeedbackV2('${appealId}')"]`
    );

  if (button) {

    button.disabled = true;

    button.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Sending...
    `;
  }

  try {

    await apiRequest(
      `/admin/appeals/${appealId}/under-review`,
      {
        method: "PATCH",

        body: {
          feedback
        }
      }
    );

    showToast(
      "Naipadala ang feedback sa notification ng owner portal at sa email."
    );

    await refreshAppealsAfterActionV2();

  } catch (error) {

    showToast(
      error.message ||
      "Failed to send appeal feedback.",
      "error"
    );

  } finally {

    if (
      button &&
      document.body.contains(button)
    ) {

      button.disabled = false;

      button.innerHTML = `
        <i class="fa-solid fa-paper-plane"></i>
        Ipadala ang Feedback
      `;
    }
  }
}

/* =========================================================
   APPROVE OR DENY APPEAL
========================================================= */

function resolveAppealV2(
  appealId,
  decision
) {

  const feedbackInput =
    document.getElementById(
      `appealFeedback-${appealId}`
    );

  const currentFeedback =
    feedbackInput
      ? feedbackInput.value.trim()
      : "";

  const defaultDecisionMessage =
    decision === "approved"
      ? "Your appeal has been approved. The related violation has been voided."
      : "Your appeal has been reviewed and denied. The related violation remains valid.";

  const modal =
    document.getElementById("resolveModal");

  const modalTitle =
    document.getElementById(
      "resolveModalTitle"
    );

  const modalInput =
    document.getElementById(
      "resolveModalInput"
    );

  const modalCancel =
    document.getElementById(
      "resolveModalCancel"
    );

  const modalConfirm =
    document.getElementById(
      "resolveModalConfirm"
    );

  if (
    !modal ||
    !modalInput ||
    !modalConfirm
  ) {

    submitAppealDecisionV2(
      appealId,
      decision,
      currentFeedback ||
      defaultDecisionMessage
    );

    return;
  }

  modalTitle.textContent =
    decision === "approved"
      ? "Approve Appeal"
      : "Deny Appeal";

  modalInput.value =
    currentFeedback &&
    currentFeedback !==
      DEFAULT_APPEAL_FEEDBACK
      ? currentFeedback
      : defaultDecisionMessage;

  modal.classList.add("show");

  modalCancel.onclick = () => {

    modal.classList.remove("show");
  };

  modalConfirm.onclick = async () => {

    const finalFeedback =
      modalInput.value.trim();

    if (!finalFeedback) {

      showToast(
        "Please provide a decision message.",
        "error"
      );

      modalInput.focus();

      return;
    }

    modalConfirm.disabled = true;

    modalConfirm.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Processing...
    `;

    await submitAppealDecisionV2(
      appealId,
      decision,
      finalFeedback
    );

    modalConfirm.disabled = false;

    modalConfirm.textContent =
      "Confirm Decision";
  };
}

async function submitAppealDecisionV2(
  appealId,
  decision,
  feedback
) {

  try {

    await apiRequest(
      `/admin/appeals/${appealId}/resolve`,
      {
        method: "PATCH",

        body: {
          decision,
          feedback
        }
      }
    );

    document
      .getElementById("resolveModal")
      ?.classList.remove("show");

    showToast(
      decision === "approved"
        ? "Appeal approved. The owner was notified through the portal."
        : "Appeal denied. The owner was notified through the portal."
    );

    await refreshAppealsAfterActionV2();

  } catch (error) {

    showToast(
      error.message ||
      "Failed to resolve the appeal.",
      "error"
    );
  }
}

/* Make inline card functions globally accessible */

window.sendAppealFeedbackV2 =
  sendAppealFeedbackV2;

window.resolveAppealV2 =
  resolveAppealV2;

/* =========================================================
   REFRESH
========================================================= */

refreshAppealsV2?.addEventListener(
  "click",
  async () => {

    refreshAppealsV2.disabled = true;

    refreshAppealsV2.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Refreshing
    `;

    await loadAppeals();

    refreshAppealsV2.disabled = false;

    refreshAppealsV2.innerHTML = `
      <i class="fa-solid fa-rotate"></i>
      Refresh
    `;
  }
);

/* =========================================================
   REFRESH AFTER ACTION
========================================================= */

async function refreshAppealsAfterActionV2() {

  await loadAppeals();

  try {

    const stats =
      await apiRequest("/admin/stats");

    updateSidebarCounts(stats);

    if (
      typeof updateExecutiveSummary ===
      "function"
    ) {

      updateExecutiveSummary(stats);
    }

    if (
      typeof updateAdminNotificationCenter ===
      "function"
    ) {

      updateAdminNotificationCenter(stats);
    }

  } catch (error) {

    console.error(
      "Appeal counter refresh error:",
      error
    );
  }
}

/* ------------------------------- ANNOUNCEMENTS ------------------------------- */

/* =========================================================
   ANNOUNCEMENTS V2
   ========================================================= */

const announcementForm =
    document.getElementById("announcementForm");

const announcementSubmitButton =
    document.getElementById("annSubmitBtn");

const announcementSubmitText =
    document.getElementById("annSubmitText");

const announcementRecipientOptions =
    document.querySelectorAll(
        ".announcement-recipient-option"
    );


/* =========================================================
   RECIPIENT SELECTOR
   ========================================================= */

announcementRecipientOptions.forEach((option) => {

    const radio =
        option.querySelector(
            'input[type="radio"]'
        );

    if (!radio) {
        return;
    }

    option.addEventListener("click", () => {

        announcementRecipientOptions.forEach(
            (item) => {
                item.classList.remove("active");
            }
        );

        option.classList.add("active");

        radio.checked = true;

        updateAnnouncementButton();
    });

});


/* =========================================================
   GET SELECTED AUDIENCE
   ========================================================= */

function getAnnouncementAudience() {

    const selected =
        document.querySelector(
            'input[name="announcementAudience"]:checked'
        );

    return selected
        ? selected.value
        : "enforcers";

}


/* =========================================================
   AUDIENCE LABEL
   ========================================================= */

function getAnnouncementAudienceLabel(
    audience
) {

    const labels = {

        enforcers:
            "All Enforcers",

        owners:
            "All Vehicle Owners",

        both:
            "Enforcers & Vehicle Owners"

    };

    return (
        labels[audience] ||
        "All Enforcers"
    );

}


/* =========================================================
   UPDATE SEND BUTTON
   ========================================================= */

function updateAnnouncementButton() {

    if (!announcementSubmitText) {
        return;
    }

    const audience =
        getAnnouncementAudience();

    announcementSubmitText.textContent =
        `Send to ${getAnnouncementAudienceLabel(
            audience
        )}`;

}


/* =========================================================
   LOAD ANNOUNCEMENTS
   ========================================================= */

async function loadAnnouncements() {

    const body =
        document.getElementById(
            "announcementsBody"
        );

    if (!body) {
        return;
    }

    try {

        const list =
            await apiRequest(
                "/admin/announcements"
            );


        if (
            !Array.isArray(list) ||
            !list.length
        ) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="4"
                        class="empty-state"
                    >
                        <i class="fa-regular fa-bell-slash"></i>

                        <strong>
                            No announcements sent yet.
                        </strong>

                        <span>
                            Published announcements will appear here.
                        </span>
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            list.map((announcement) => {

                const audience =
                    announcement.audience ||
                    "enforcers";

                const audienceLabel =
                    getAnnouncementAudienceLabel(
                        audience
                    );

                const audienceClass =
                    audience === "owners"
                        ? "owners"
                        : audience === "both"
                            ? "both"
                            : "enforcers";


                return `
                    <tr>

                        <td>
                            <div class="announcement-history-title">

                                <strong>
                                    ${escapeHtml(
                                        announcement.title ||
                                        "Untitled announcement"
                                    )}
                                </strong>

                            </div>
                        </td>


                        <td>
                            <div class="announcement-history-message">
                                ${escapeHtml(
                                    announcement.message ||
                                    "—"
                                )}
                            </div>
                        </td>


                        <td>
                            <span
                                class="announcement-audience-chip ${audienceClass}"
                            >
                                <i class="fa-solid ${
                                    audience === "owners"
                                        ? "fa-car-side"
                                        : audience === "both"
                                            ? "fa-bullhorn"
                                            : "fa-user-shield"
                                }"></i>

                                ${escapeHtml(
                                    audienceLabel
                                )}
                            </span>
                        </td>


                        <td class="text-muted">
                            ${formatDate(
                                announcement.createdAt
                            )}
                        </td>

                    </tr>
                `;

            }).join("");


    } catch (error) {

        console.error(
            "Announcements loading error:",
            error
        );

        body.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="empty-state error"
                >
                    Unable to load announcement history.
                </td>
            </tr>
        `;

        showToast(
            error.message ||
            "Failed to load announcements.",
            "error"
        );

    }

}


/* =========================================================
   SEND ANNOUNCEMENT
   ========================================================= */

function openAnnouncementConfirmModal({
    title,
    audienceLabel,
    onConfirm
}) {

    const modal =
        document.getElementById(
            "announcementConfirmModal"
        );

    const titleElement =
        document.getElementById(
            "announcementConfirmMessageTitle"
        );

    const audienceElement =
        document.getElementById(
            "announcementConfirmAudience"
        );

    const cancelButton =
        document.getElementById(
            "announcementConfirmCancel"
        );

    const sendButton =
        document.getElementById(
            "announcementConfirmSend"
        );


    if (
        !modal ||
        !titleElement ||
        !audienceElement ||
        !cancelButton ||
        !sendButton
    ) {

        console.error(
            "Announcement confirmation modal elements not found."
        );

        return;

    }


    titleElement.textContent =
        title || "Untitled announcement";

    audienceElement.textContent =
        audienceLabel || "All Enforcers";


    modal.classList.add("show");


    cancelButton.onclick = () => {

        modal.classList.remove("show");

    };


    sendButton.onclick = async () => {

        sendButton.disabled = true;

        sendButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Sending...
        `;


        try {

            await onConfirm();

        } finally {

            sendButton.disabled = false;

            sendButton.innerHTML = `
                <i class="fa-solid fa-paper-plane"></i>
                Send Announcement
            `;

        }

    };

}

announcementForm?.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const title =
            document
                .getElementById("annTitle")
                ?.value
                .trim() || "";


        const message =
            document
                .getElementById("annMessage")
                ?.value
                .trim() || "";


        const audience =
            getAnnouncementAudience();


        /* VALIDATION */

        if (!title) {

            showToast(
                "Please enter an announcement title.",
                "error"
            );

            document
                .getElementById("annTitle")
                ?.focus();

            return;

        }


        if (!message) {

            showToast(
                "Please enter an announcement message.",
                "error"
            );

            document
                .getElementById("annMessage")
                ?.focus();

            return;

        }


        /* CONFIRM */

        const audienceLabel =
            getAnnouncementAudienceLabel(
                audience
            );

        return openAnnouncementConfirmModal({
          title,
          audienceLabel,

          onConfirm: async () => {

            if (announcementSubmitButton) {
                announcementSubmitButton.disabled = true;
            }

            if (announcementSubmitText) {
              announcementSubmitText.textContent =
                "Sending announcement...";
            }

            try {

              const result = await apiRequest(
                  "/admin/announcements",
                  {
                      method: "POST",

                      body: {
                          title,
                          message,
                          audience
                      }
                  }
              );


              document
                  .getElementById(
                      "announcementConfirmModal"
                  )
                  ?.classList.remove("show");


              showToast(
                  result.message ||
                  "Announcement sent successfully."
              );


              announcementForm.reset();


              const defaultAudience =
                  document.getElementById(
                      "audienceEnforcers"
                  );

              if (defaultAudience) {
                defaultAudience.checked = true;
              }


              announcementRecipientOptions.forEach(
                (option) => {
                    option.classList.remove("active");
                }
              );


              document
                .querySelector(
                    'label[for="audienceEnforcers"]'
                )
                ?.classList.add("active");


              updateAnnouncementButton();


              await loadAnnouncements();


            } catch (error) {

              console.error(
                "Announcement sending error:",
                error
              );

              showToast(
                error.message ||
                "Failed to send announcement.",
                "error"
              );

            } finally {

              if (announcementSubmitButton) {
                announcementSubmitButton.disabled = false;
              }

              updateAnnouncementButton();

            }

          }
        });

        /* LOADING */

        if (announcementSubmitButton) {

            announcementSubmitButton.disabled =
                true;

        }

        if (announcementSubmitText) {

            announcementSubmitText.textContent =
                "Sending announcement...";

        }


        try {

            const result =
                await apiRequest(
                    "/admin/announcements",
                    {
                        method: "POST",

                        body: {
                            title,
                            message,
                            audience
                        }
                    }
                );


            showToast(
                result.message ||
                "Announcement sent successfully."
            );


            announcementForm.reset();


            /* Restore default */

            const defaultAudience =
                document.getElementById(
                    "audienceEnforcers"
                );

            if (defaultAudience) {

                defaultAudience.checked =
                    true;

            }


            announcementRecipientOptions.forEach(
                (option) => {

                    option.classList.remove(
                        "active"
                    );

                }
            );


            document
                .querySelector(
                    'label[for="audienceEnforcers"]'
                )
                ?.classList.add("active");


            updateAnnouncementButton();


            await loadAnnouncements();


        } catch (error) {

            console.error(
                "Announcement sending error:",
                error
            );

            showToast(
                error.message ||
                "Failed to send announcement.",
                "error"
            );

        } finally {

            if (announcementSubmitButton) {

                announcementSubmitButton.disabled =
                    false;

            }

            updateAnnouncementButton();

        }

    }
);


/* INITIAL BUTTON STATE */

updateAnnouncementButton();

/* ------------------------------- REASON MODAL (shared) ------------------------------- */

function openReasonModal({ title, sub, onConfirm }) {
  const modal = document.getElementById("reasonModal");
  document.getElementById("reasonModalTitle").textContent = title;
  document.getElementById("reasonModalSub").textContent = sub;
  const input = document.getElementById("reasonModalInput");
  input.value = "";
  modal.classList.add("show");

  document.getElementById("reasonModalCancel").onclick = () => modal.classList.remove("show");
  document.getElementById("reasonModalConfirm").onclick = () => {
    modal.classList.remove("show");
    onConfirm(input.value.trim());
  };
}

/* ------------------------- OWNER APPLICATION DETAILS MODAL ------------------------- */
// Shared by both the older table-based "Vehicle Owner Applications" view and
// the newer card-based "Account Approvals" view -- `source` ("old" or "v2")
// says which in-memory list to look the owner up in, and which
// approve/reject functions to call when the modal's own buttons are used.

function viewOwnerApplicationDetails(ownerId) {
  const owner = (pendingOwnersV2 || []).find((o) => o._id === ownerId);

  if (!owner) {
    showToast("Could not find this application's details.", "error");
    return;
  }

  const vehicles = [
    {
      plateNumber: owner.plateNumber,
      vehicleType: owner.vehicleType,
      vehicleColor: owner.vehicleColor,
      label: "Vehicle 1",
    },
    ...(Array.isArray(owner.additionalVehicles)
      ? owner.additionalVehicles.map((v, i) => ({ ...v, label: `Vehicle ${i + 2}` }))
      : []),
  ];

  const vehiclesHtml = vehicles.map((v) => `
    <div class="owner-details-vehicle-block">
      <span class="owner-details-vehicle-label">${escapeHtml(v.label)}</span>
      <div class="approval-detail-row">
        <span>Plate Number</span>
        <strong><span class="plate-chip">${escapeHtml(v.plateNumber || "—")}</span></strong>
      </div>
      <div class="approval-detail-row">
        <span>Vehicle Type</span>
        <strong>${escapeHtml(v.vehicleType || "—")}</strong>
      </div>
      <div class="approval-detail-row">
        <span>Vehicle Color</span>
        <strong>${escapeHtml(v.vehicleColor || "—")}</strong>
      </div>
    </div>
  `).join("");

  const body = document.getElementById("ownerDetailsModalBody");
  body.innerHTML = `
    <div class="approval-detail-row">
      <span>Full Name</span>
      <strong>${escapeHtml(owner.fullName || "—")}</strong>
    </div>
    <div class="approval-detail-row">
      <span>Email</span>
      <strong>${escapeHtml(owner.email || "—")}</strong>
    </div>
    <div class="approval-detail-row">
      <span>Contact Number</span>
      <strong>${escapeHtml(owner.contactNumber || "—")}</strong>
    </div>
    <div class="approval-detail-row">
      <span>Address</span>
      <strong>${escapeHtml(owner.address || "—")}</strong>
    </div>
    <div class="approval-detail-row">
      <span>Submitted</span>
      <strong>${escapeHtml(formatDate(owner.createdAt))}</strong>
    </div>
    ${vehiclesHtml}
  `;

  const modal = document.getElementById("ownerDetailsModal");
  modal.classList.add("show");

  document.getElementById("ownerDetailsModalClose").onclick = () => {
    modal.classList.remove("show");
  };

  document.getElementById("ownerDetailsModalApprove").onclick = () => {
    modal.classList.remove("show");
    approveOwnerApplicationV2(ownerId);
  };

  document.getElementById("ownerDetailsModalReject").onclick = () => {
    modal.classList.remove("show");
    rejectOwnerApplicationV2(ownerId);
  };
}

window.viewOwnerApplicationDetails = viewOwnerApplicationDetails;

/* ------------------------------------ Init ------------------------------------ */
// NOTE: the actual initial-view bootstrap (which restores the last active
// view from the URL hash on refresh) runs at the very end of this file,
// after everything above — including updateDashboardBackButton()'s
// `dashboardBackButton` — is defined. Calling switchView() this early
// would throw before that's declared.

/* =========================================================
   ADMIN DASHBOARD V2 — UI SUPPORT
========================================================= */

const adminSidebar = document.getElementById("adminSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const mobileSidebarButton = document.getElementById("mobileSidebarButton");
const sidebarCloseButton = document.getElementById("sidebarCloseButton");

const headerAdminName = document.getElementById("headerAdminName");
const dashboardCurrentDate = document.getElementById("dashboardCurrentDate");

const quickActionButtons = document.querySelectorAll(
    "[data-target-view]"
);

/* =========================================================
   ADMIN NAME IN GLOBAL HEADER
========================================================= */

if (admin && headerAdminName) {

    headerAdminName.textContent =
        admin.fullName ||
        admin.email ||
        "Administrator";
}

/* =========================================================
   CURRENT DATE
========================================================= */

if (dashboardCurrentDate) {

    dashboardCurrentDate.textContent =
        new Date().toLocaleDateString(
            "en-PH",
            {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
            }
        );
}

/* =========================================================
   QUICK ACTIONS
========================================================= */

quickActionButtons.forEach((button) => {

    button.addEventListener("click", () => {

        const targetView =
            button.dataset.targetView;

        if (!targetView) {
            return;
        }

        switchView(targetView);

        closeMobileSidebar();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
});

/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function openMobileSidebar() {

    if (!adminSidebar || !sidebarOverlay) {
        return;
    }

    adminSidebar.classList.add("show");
    sidebarOverlay.classList.add("show");

    document.body.style.overflow = "hidden";
}

function closeMobileSidebar() {

    if (!adminSidebar || !sidebarOverlay) {
        return;
    }

    adminSidebar.classList.remove("show");
    sidebarOverlay.classList.remove("show");

    document.body.style.overflow = "";
}

if (mobileSidebarButton) {

    mobileSidebarButton.addEventListener(
        "click",
        openMobileSidebar
    );
}

if (sidebarCloseButton) {

    sidebarCloseButton.addEventListener(
        "click",
        closeMobileSidebar
    );
}

if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        closeMobileSidebar
    );
}

/* Close mobile sidebar after selecting a navigation item */

navItems.forEach((item) => {

    item.addEventListener(
        "click",
        closeMobileSidebar
    );
});

/* =========================================================
   ESCAPE KEY SUPPORT
========================================================= */

document.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {

        closeMobileSidebar();

        document
            .querySelectorAll(".modal-backdrop.show")
            .forEach((modal) => {
                modal.classList.remove("show");
            });
    }
});

/* =========================================================
   CLOSE MODAL WHEN BACKDROP IS CLICKED
========================================================= */

document
    .querySelectorAll(".modal-backdrop")
    .forEach((modal) => {

        modal.addEventListener("click", (event) => {

            if (event.target === modal) {
                modal.classList.remove("show");
            }
        });
    });

    /* ==========================================================
   DYNAMIC BACK BUTTON
========================================================== */

const dashboardBackButton =
  document.getElementById("dashboardBackButton");

function updateDashboardBackButton(viewName) {
  if (!dashboardBackButton) return;

  dashboardBackButton.style.display =
    viewName === "overview" ? "none" : "flex";
}

if (dashboardBackButton) {
  dashboardBackButton.addEventListener("click", () => {
    switchView("overview");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}

/* Initial state */
updateDashboardBackButton("overview");

/* =========================================================
   DASHBOARD STAT COUNTERS
========================================================= */

function animateStatCounters() {

  document
    .querySelectorAll(".animated-stat")
    .forEach((element) => {

      const target = Number(element.dataset.value || 0);
      const duration = 700;
      const startTime = performance.now();

      function updateCounter(currentTime) {

        const progress = Math.min(
          (currentTime - startTime) / duration,
          1
        );

        const eased =
          1 - Math.pow(1 - progress, 3);

        element.textContent =
          Math.floor(target * eased).toLocaleString("en-PH");

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          element.textContent =
            target.toLocaleString("en-PH");
        }
      }

      requestAnimationFrame(updateCounter);
    });
}

/* =========================================================
   ADMIN HEADER V3
========================================================= */

const headerLiveTime =
  document.getElementById("headerLiveTime");

const headerLiveDate =
  document.getElementById("headerLiveDate");

const notificationButton =
  document.getElementById("notificationButton");

const notificationDropdown =
  document.getElementById("notificationDropdown");

const notificationCloseButton =
  document.getElementById("notificationCloseButton");

const headerNotificationCount =
  document.getElementById("headerNotificationCount");

const adminNotificationList =
  document.getElementById("adminNotificationList");

let latestAdminStats = null;

function updateHeaderDateTime() {

  const now = new Date();

  if (headerLiveTime) {

    headerLiveTime.textContent =
      now.toLocaleTimeString(
        "en-PH",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }
      );
  }

  if (headerLiveDate) {

    headerLiveDate.textContent =
      now.toLocaleDateString(
        "en-PH",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric"
        }
      );
  }
}

updateHeaderDateTime();

setInterval(
  updateHeaderDateTime,
  1000
);

function openAdminNotifications() {

  if (!notificationDropdown) {
    return;
  }

  notificationDropdown.classList.add("show");

  notificationButton?.setAttribute(
    "aria-expanded",
    "true"
  );
}

function closeAdminNotifications() {

  if (!notificationDropdown) {
    return;
  }

  notificationDropdown.classList.remove("show");

  notificationButton?.setAttribute(
    "aria-expanded",
    "false"
  );
}

notificationButton?.addEventListener(
  "click",
  (event) => {

    event.stopPropagation();

    notificationDropdown?.classList.contains("show")
      ? closeAdminNotifications()
      : openAdminNotifications();
  }
);

notificationCloseButton?.addEventListener(
  "click",
  closeAdminNotifications
);

document.addEventListener("click", (event) => {

  if (
    notificationDropdown &&
    notificationButton &&
    !notificationDropdown.contains(event.target) &&
    !notificationButton.contains(event.target)
  ) {

    closeAdminNotifications();
  }
});

function updateAdminNotificationCenter(stats) {

  if (!stats || !adminNotificationList) {
    return;
  }

  latestAdminStats = stats;

  const totalAlerts =
    Number(stats.pendingEnforcers || 0) +
    Number(stats.pendingOwners || 0) +
    Number(stats.pendingAppeals || 0);

  if (headerNotificationCount) {

    if (totalAlerts > 0) {

      headerNotificationCount.style.display =
        "flex";

      headerNotificationCount.textContent =
        totalAlerts > 99
          ? "99+"
          : String(totalAlerts);

    } else {

      headerNotificationCount.style.display =
        "none";
    }
  }

  const items = [];

  if (stats.pendingEnforcers > 0) {

    items.push(`
      <button
        type="button"
        class="notification-item"
        data-notification-view="enforcer-approvals"
      >
        <span class="notification-item-icon">
          <i class="fa-solid fa-user-check"></i>
        </span>

        <span class="notification-item-content">
          <strong>Pending Enforcer Applications</strong>
          <span>
            New traffic-enforcer accounts require administrator review.
          </span>
        </span>

        <span class="notification-count-chip">
          ${stats.pendingEnforcers}
        </span>
      </button>
    `);
  }

  if (stats.pendingOwners > 0) {

    items.push(`
      <button
        type="button"
        class="notification-item owner"
        data-notification-view="owner-approvals"
      >
        <span class="notification-item-icon">
          <i class="fa-solid fa-car-side"></i>
        </span>

        <span class="notification-item-content">
          <strong>Pending Owner Applications</strong>
          <span>
            Vehicle-owner registrations are waiting for approval.
          </span>
        </span>

        <span class="notification-count-chip">
          ${stats.pendingOwners}
        </span>
      </button>
    `);
  }

  if (stats.pendingAppeals > 0) {

    items.push(`
      <button
        type="button"
        class="notification-item appeal"
        data-notification-view="appeals"
      >
        <span class="notification-item-icon">
          <i class="fa-solid fa-scale-balanced"></i>
        </span>

        <span class="notification-item-content">
          <strong>Appeals Awaiting Action</strong>
          <span>
            Vehicle-owner appeals require feedback or a final decision.
          </span>
        </span>

        <span class="notification-count-chip">
          ${stats.pendingAppeals}
        </span>
      </button>
    `);
  }

  adminNotificationList.innerHTML =
    items.length
      ? items.join("")
      : `
        <div class="notification-empty-state">
          <i class="fa-regular fa-circle-check"></i>
          <span>
            All administrator review queues are clear.
          </span>
        </div>
      `;

  adminNotificationList
    .querySelectorAll("[data-notification-view]")
    .forEach((item) => {

      item.addEventListener("click", () => {

        const target =
          item.dataset.notificationView;

        closeAdminNotifications();

        // The old separate "Enforcer Applications" and "Owner Applications"
        // pages were merged into one Account Approvals page with two tabs,
        // so these notifications open that page on the matching tab.
        if (target === "enforcer-approvals" || target === "owner-approvals") {
          switchView("account-approvals");
          setApprovalTab(target === "owner-approvals" ? "owners" : "enforcers");
          return;
        }

        switchView(target);
      });
    });
}

/* =========================================================
   EXECUTIVE DASHBOARD V3
========================================================= */

const executiveGreeting =
  document.getElementById("executiveGreeting");

const summaryApprovedEnforcers =
  document.getElementById("summaryApprovedEnforcers");

const summaryReportsToday =
  document.getElementById("summaryReportsToday");

const summaryPendingAppeals =
  document.getElementById("summaryPendingAppeals");

const summaryPendingApprovals =
  document.getElementById("summaryPendingApprovals");

const summaryLastUpdated =
  document.getElementById("summaryLastUpdated");

const quickPendingApprovals =
  document.getElementById("quickPendingApprovals");

const quickPendingAppeals =
  document.getElementById("quickPendingAppeals");

const chartTotalReports =
  document.getElementById("chartTotalReports");

const chartHighestMonth =
  document.getElementById("chartHighestMonth");

const chartMonthlyAverage =
  document.getElementById("chartMonthlyAverage");

const monthlyChartEmpty =
  document.getElementById("monthlyChartEmpty");

const executiveActivityList =
  document.getElementById("executiveActivityList");

const refreshActivityButton =
  document.getElementById("refreshLiveActivity");

const liveActivityUpdated =
  document.getElementById("liveActivityUpdated");

const chartPeriodButtons =
  document.querySelectorAll("[data-chart-period]");

let monthlyViolationsChartInstance = null;
let executiveViolationsCache = [];
let executiveAppealsCache = [];
let executiveEnforcersCache = [];
let executiveOwnersCache = [];
let activeChartPeriod = 6;

/* =========================================================
   GREETING
========================================================= */

function updateExecutiveGreeting() {

  if (!executiveGreeting) {
    return;
  }

  const hour = new Date().getHours();

  let greeting = "Good evening";

  if (hour < 12) {
    greeting = "Good morning";
  } else if (hour < 18) {
    greeting = "Good afternoon";
  }

  const administrator =
    Auth.getUser();

  const firstName =
    administrator?.fullName
      ? administrator.fullName.split(" ")[0]
      : "Administrator";

  executiveGreeting.textContent =
    `${greeting}, ${firstName}.`;
}

updateExecutiveGreeting();

/* =========================================================
   EXECUTIVE SUMMARY
========================================================= */

function updateExecutiveSummary(stats) {

  if (!stats) {
    return;
  }

  const pendingApprovals =
    Number(stats.pendingEnforcers || 0) +
    Number(stats.pendingOwners || 0);

  if (summaryApprovedEnforcers) {
    summaryApprovedEnforcers.textContent =
      Number(stats.totalEnforcers || 0)
        .toLocaleString("en-PH");
  }

  if (summaryReportsToday) {
    summaryReportsToday.textContent =
      Number(stats.violationsToday || 0)
        .toLocaleString("en-PH");
  }

  if (summaryPendingAppeals) {
    summaryPendingAppeals.textContent =
      Number(stats.pendingAppeals || 0)
        .toLocaleString("en-PH");
  }

  if (summaryPendingApprovals) {
    summaryPendingApprovals.textContent =
      pendingApprovals.toLocaleString("en-PH");
  }

  if (quickPendingApprovals) {
    quickPendingApprovals.textContent =
      pendingApprovals.toLocaleString("en-PH");
  }

  if (quickPendingAppeals) {
    quickPendingAppeals.textContent =
      Number(stats.pendingAppeals || 0)
        .toLocaleString("en-PH");
  }

  if (summaryLastUpdated) {

    summaryLastUpdated.textContent =
      `Last updated ${new Date().toLocaleTimeString(
        "en-PH",
        {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit"
        }
      )}`;
  }
}

/* =========================================================
   MONTHLY VIOLATIONS CHART
========================================================= */

function getMonthKey(date) {

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function buildMonthlyViolationData(
  violations,
  monthCount = 6
) {

  const now = new Date();

  const months = [];

  for (
    let index = monthCount - 1;
    index >= 0;
    index--
  ) {

    const date =
      new Date(
        now.getFullYear(),
        now.getMonth() - index,
        1
      );

    months.push({
      key: getMonthKey(date),

      label: date.toLocaleDateString(
        "en-PH",
        {
          month: "short",
          year: "2-digit"
        }
      ),

      fullLabel: date.toLocaleDateString(
        "en-PH",
        {
          month: "long",
          year: "numeric"
        }
      ),

      value: 0
    });
  }

  const monthLookup =
    new Map(
      months.map((month) => [
        month.key,
        month
      ])
    );

  violations.forEach((violation) => {

    const rawDate =
      violation.dateTime ||
      violation.createdAt;

    if (!rawDate) {
      return;
    }

    const date = new Date(rawDate);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    const matchingMonth =
      monthLookup.get(getMonthKey(date));

    if (matchingMonth) {
      matchingMonth.value += 1;
    }
  });

  return months;
}

function renderMonthlyViolationsChart(
  violations,
  monthCount = 6
) {

  const canvas =
    document.getElementById(
      "monthlyViolationsChart"
    );

  if (
    !canvas ||
    typeof Chart === "undefined"
  ) {
    return;
  }

  const monthlyData =
    buildMonthlyViolationData(
      violations,
      monthCount
    );

  const total =
    monthlyData.reduce(
      (sum, month) =>
        sum + month.value,
      0
    );

  const highestMonth =
    monthlyData.reduce(
      (highest, month) =>
        month.value > highest.value
          ? month
          : highest,
      monthlyData[0] || {
        value: 0,
        fullLabel: "—"
      }
    );

  const average =
    monthlyData.length
      ? total / monthlyData.length
      : 0;

  if (chartTotalReports) {
    chartTotalReports.textContent =
      total.toLocaleString("en-PH");
  }

  if (chartHighestMonth) {
    chartHighestMonth.textContent =
      highestMonth?.value > 0
        ? highestMonth.fullLabel
        : "—";
  }

  if (chartMonthlyAverage) {
    chartMonthlyAverage.textContent =
      average.toLocaleString(
        "en-PH",
        {
          maximumFractionDigits: 1
        }
      );
  }

  if (monthlyChartEmpty) {
    monthlyChartEmpty.style.display =
      total > 0
        ? "none"
        : "flex";
  }

  if (monthlyViolationsChartInstance) {
    monthlyViolationsChartInstance.destroy();
  }

  const context =
    canvas.getContext("2d");

  const gradient =
    context.createLinearGradient(
      0,
      0,
      0,
      290
    );

  gradient.addColorStop(
    0,
    "rgba(91, 140, 255, 0.36)"
  );

  gradient.addColorStop(
    1,
    "rgba(61, 108, 255, 0.01)"
  );

  monthlyViolationsChartInstance =
    new Chart(
      context,
      {
        type: "line",

        data: {
          labels: monthlyData.map(
            (month) => month.label
          ),

          datasets: [
            {
              label: "Violation Reports",

              data: monthlyData.map(
                (month) => month.value
              ),

              borderColor:
                "rgba(115, 153, 255, 1)",

              backgroundColor:
                gradient,

              borderWidth: 2,

              fill: true,

              tension: 0.4,

              pointRadius: 3,

              pointHoverRadius: 6,

              pointBackgroundColor:
                "#8faaff",

              pointBorderColor:
                "#102541",

              pointBorderWidth: 2
            }
          ]
        },

        options: {
          responsive: true,
          maintainAspectRatio: false,

          interaction: {
            intersect: false,
            mode: "index"
          },

          plugins: {
            legend: {
              display: false
            },

            tooltip: {
              backgroundColor:
                "rgba(10, 27, 49, 0.96)",

              titleColor:
                "#ffffff",

              bodyColor:
                "#aebdd2",

              borderColor:
                "rgba(255,255,255,.08)",

              borderWidth: 1,

              padding: 11,

              displayColors: false,

              callbacks: {
                label(context) {

                  return `${context.parsed.y} violation report${
                    context.parsed.y === 1
                      ? ""
                      : "s"
                  }`;
                }
              }
            }
          },

          scales: {
            x: {
              grid: {
                display: false
              },

              border: {
                display: false
              },

              ticks: {
                color: "#617694",
                font: {
                  size: 10
                }
              }
            },

            y: {
              beginAtZero: true,

              suggestedMax:
                Math.max(
                  5,
                  ...monthlyData.map(
                    (month) => month.value
                  )
                ),

              grid: {
                color:
                  "rgba(255,255,255,.045)"
              },

              border: {
                display: false
              },

              ticks: {
                precision: 0,

                color: "#617694",

                font: {
                  size: 10
                }
              }
            }
          }
        }
      }
    );
}

/* =========================================================
   CHART PERIOD CONTROLS
========================================================= */

chartPeriodButtons.forEach((button) => {

  button.addEventListener(
    "click",
    () => {

      chartPeriodButtons.forEach(
        (item) =>
          item.classList.remove("active")
      );

      button.classList.add("active");

      activeChartPeriod =
        Number(
          button.dataset.chartPeriod
        ) || 6;

      renderMonthlyViolationsChart(
        executiveViolationsCache,
        activeChartPeriod
      );
    }
  );
});

/* =========================================================
   ACTIVITY FEED
========================================================= */

function buildExecutiveActivities() {

  const activities = [];

  executiveViolationsCache.forEach(
    (violation) => {

      activities.push({
        type: "violation",

        title:
          "Violation report recorded",

        message:
          `${
            violation.enforcer?.fullName ||
            "Traffic enforcer"
          } reported ${
            violation.violationType ||
            "a traffic violation"
          } for plate ${
            violation.plateNumber ||
            "—"
          }.`,

        date:
          violation.dateTime ||
          violation.createdAt,

        icon:
          "fa-solid fa-triangle-exclamation"
      });
    }
  );

  executiveAppealsCache.forEach(
    (appeal) => {

      activities.push({
        type: "appeal",

        title:
          "Vehicle owner appeal submitted",

        message:
          `${
            appeal.owner?.fullName ||
            "A vehicle owner"
          } submitted an appeal${
            appeal.violation?.plateNumber
              ? ` for plate ${appeal.violation.plateNumber}`
              : ""
          }.`,

        date: appeal.createdAt,

        icon:
          "fa-solid fa-scale-balanced"
      });
    }
  );

  executiveEnforcersCache.forEach(
    (enforcer) => {

      activities.push({
        type:
          enforcer.status === "approved"
            ? "approval"
            : "account",

        title:
          enforcer.status === "approved"
            ? "Enforcer account approved"
            : "Enforcer registration received",

        message:
          `${enforcer.fullName || "Enforcer"} — ${
            enforcer.badgeNumber || "No badge"
          }.`,

        date:
          enforcer.reviewedAt ||
          enforcer.createdAt,

        icon:
          enforcer.status === "approved"
            ? "fa-solid fa-user-check"
            : "fa-solid fa-user-clock"
      });
    }
  );

  executiveOwnersCache.forEach(
    (owner) => {

      activities.push({
        type:
          owner.status === "approved"
            ? "approval"
            : "account",

        title:
          owner.status === "approved"
            ? "Vehicle owner approved"
            : "Owner registration received",

        message:
          `${owner.fullName || "Vehicle owner"}${
            owner.plateNumber
              ? ` — ${owner.plateNumber}`
              : ""
          }.`,

        date:
          owner.reviewedAt ||
          owner.createdAt,

        icon:
          owner.status === "approved"
            ? "fa-solid fa-circle-check"
            : "fa-solid fa-car-side"
      });
    }
  );

  return activities
    .filter((activity) => activity.date)
    .sort(
      (first, second) =>
        new Date(second.date) -
        new Date(first.date)
    )
    .slice(0, 10);
}

function updateLiveActivityTimestamp() {

  if (!liveActivityUpdated) {
    return;
  }

  const now = new Date();

  liveActivityUpdated.textContent =
    `Updated ${now.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit"
    })}`;

}

function renderExecutiveActivity() {

  if (!executiveActivityList) {
    return;
  }

  const activities =
    buildExecutiveActivities();

  updateLiveActivityTimestamp();

  if (!activities.length) {

    executiveActivityList.innerHTML = `
      <div class="activity-empty-state">
        <i class="fa-solid fa-clock-rotate-left"></i>

        <strong>
          No recent activity yet
        </strong>

        <span>
          Enforcement and administrative events will appear here.
        </span>
      </div>
    `;

    return;
  }

  executiveActivityList.innerHTML =
    activities.map((activity) => {

      const activityDate =
        new Date(activity.date);

      const time =
        activityDate.toLocaleTimeString(
          "en-PH",
          {
            hour: "numeric",
            minute: "2-digit"
          }
        );

      const date =
        activityDate.toLocaleDateString(
          "en-PH",
          {
            month: "short",
            day: "numeric"
          }
        );

      return `
        <article class="executive-activity-item">

          <div class="activity-item-icon ${activity.type}">

            <i class="${activity.icon}"></i>

          </div>

          <div class="activity-item-content">

            <strong>
              ${escapeHtml(activity.title)}
            </strong>

            <span>
              ${escapeHtml(activity.message)}
            </span>

          </div>

          <time class="activity-item-time">

            ${escapeHtml(time)}
            <br>
            ${escapeHtml(date)}

          </time>

        </article>
      `;
    }).join("");
}

/* =========================================================
   PERFORMANCE LEADERBOARD V3
========================================================= */

function renderExecutiveLeaderboard(
  leaderboard
) {

  const body =
    document.getElementById(
      "leaderboardBody"
    );

  if (!body) {
    return;
  }

  if (!leaderboard.length) {

    body.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-state"
        >
          No violation reports have been filed yet.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML =
    leaderboard.map(
      (row, index) => {

        let rankClass = "";

        if (index === 0) {
          rankClass = "top-one";
        } else if (index === 1) {
          rankClass = "top-two";
        } else if (index === 2) {
          rankClass = "top-three";
        }

        return `
          <tr>

            <td>

              <span class="performance-rank ${rankClass}">

                ${index + 1}

              </span>

            </td>

            <td>

              ${escapeHtml(row.fullName)}

            </td>

            <td class="mono">

              ${escapeHtml(
                row.badgeNumber
              )}

            </td>

            <td>

              ${escapeHtml(
                row.station || "—"
              )}

            </td>

            <td>

              ${statusChip(row.status)}

            </td>

            <td class="mono">

              ${Number(
                row.totalReports || 0
              ).toLocaleString("en-PH")}

            </td>

          </tr>
        `;
      }
    ).join("");
}

/* =========================================================
   LOAD EXECUTIVE DATA
========================================================= */

async function loadExecutiveDashboardData() {

  try {

    const [
      violations,
      appeals,
      enforcers,
      owners
    ] = await Promise.all([
      apiRequest("/admin/violations"),
      apiRequest("/admin/appeals"),
      apiRequest("/admin/enforcers"),
      apiRequest("/admin/owners")
    ]);

    executiveViolationsCache =
      Array.isArray(violations)
        ? violations
        : [];

    executiveAppealsCache =
      Array.isArray(appeals)
        ? appeals
        : [];

    executiveEnforcersCache =
      Array.isArray(enforcers)
        ? enforcers
        : [];

    executiveOwnersCache =
      Array.isArray(owners)
        ? owners
        : [];

    renderMonthlyViolationsChart(
      executiveViolationsCache,
      activeChartPeriod
    );

    renderExecutiveActivity();

  } catch (error) {

    console.error(
      "Executive dashboard error:",
      error
    );

    showToast(
      error.message ||
      "Failed to load executive dashboard data.",
      "error"
    );
  }
}

refreshActivityButton?.addEventListener(
  "click",
  async () => {

    refreshActivityButton.disabled = true;

    refreshActivityButton.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Refreshing
    `;

    await loadExecutiveDashboardData();

    refreshActivityButton.disabled = false;

    refreshActivityButton.innerHTML = `
      <i class="fa-solid fa-rotate"></i>
      Refresh
    `;
  }
);

/* =========================================================
   ACCOUNT APPROVALS V2
========================================================= */

const approvalTabButtons =
  document.querySelectorAll(
    "[data-approval-tab]"
  );

const approvalPanelEnforcers =
  document.getElementById(
    "approvalPanelEnforcers"
  );

const approvalPanelOwners =
  document.getElementById(
    "approvalPanelOwners"
  );

const enforcerApprovalCards =
  document.getElementById(
    "enforcerApprovalCards"
  );

const ownerApprovalCards =
  document.getElementById(
    "ownerApprovalCards"
  );

const accountApprovalTotal =
  document.getElementById(
    "accountApprovalTotal"
  );

const enforcerApprovalTabCount =
  document.getElementById(
    "enforcerApprovalTabCount"
  );

const ownerApprovalTabCount =
  document.getElementById(
    "ownerApprovalTabCount"
  );

const enforcerApprovalSearch =
  document.getElementById(
    "enforcerApprovalSearch"
  );

const ownerApprovalSearch =
  document.getElementById(
    "ownerApprovalSearch"
  );

const refreshEnforcerApprovals =
  document.getElementById(
    "refreshEnforcerApprovals"
  );

const refreshOwnerApprovals =
  document.getElementById(
    "refreshOwnerApprovals"
  );

let pendingEnforcersV2 = [];
let pendingOwnersV2 = [];

/* =========================================================
   TAB SWITCHING
========================================================= */

// Shows one tab ("enforcers" or "owners") of the Account Approvals page.
// Used by the tab buttons and by the header notifications.
function setApprovalTab(selectedTab) {

  approvalTabButtons.forEach((item) => {

    item.classList.toggle(
      "active",
      item.dataset.approvalTab === selectedTab
    );
  });

  if (approvalPanelEnforcers) {

    approvalPanelEnforcers.classList.toggle(
      "active",
      selectedTab === "enforcers"
    );
  }

  if (approvalPanelOwners) {

    approvalPanelOwners.classList.toggle(
      "active",
      selectedTab === "owners"
    );
  }
}

approvalTabButtons.forEach((button) => {

  button.addEventListener("click", () => {

    setApprovalTab(button.dataset.approvalTab);
  });
});

/* =========================================================
   HELPERS
========================================================= */

function getApplicantInitial(name) {

  const normalizedName =
    String(name || "")
      .trim();

  if (!normalizedName) {
    return "U";
  }

  return normalizedName
    .charAt(0)
    .toUpperCase();
}

function isValidGmailAddress(email) {

  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(
    String(email || "").trim()
  );
}

function updateApprovalCountersV2() {

  const enforcerCount =
    pendingEnforcersV2.length;

  const ownerCount =
    pendingOwnersV2.length;

  const total =
    enforcerCount + ownerCount;

  if (enforcerApprovalTabCount) {

    enforcerApprovalTabCount.textContent =
      String(enforcerCount);
  }

  if (ownerApprovalTabCount) {

    ownerApprovalTabCount.textContent =
      String(ownerCount);
  }

  if (accountApprovalTotal) {

    accountApprovalTotal.textContent =
      `${total} pending`;
  }

  setCount(
    "countAccountApprovals",
    total
  );
}

function setApprovalLoading(
  container,
  message
) {

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="approval-loading-state">

      <i class="fa-solid fa-spinner fa-spin"></i>

      <strong>
        ${escapeHtml(message)}
      </strong>

    </div>
  `;
}

function setApprovalEmpty(
  container,
  title,
  message
) {

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="approval-empty-state">

      <i class="fa-regular fa-circle-check"></i>

      <strong>
        ${escapeHtml(title)}
      </strong>

      <span>
        ${escapeHtml(message)}
      </span>

    </div>
  `;
}

/* =========================================================
   LOAD ALL APPROVALS
========================================================= */

async function loadAccountApprovalsV2() {

  if (
    !enforcerApprovalCards ||
    !ownerApprovalCards
  ) {
    return;
  }

  setApprovalLoading(
    enforcerApprovalCards,
    "Loading enforcer applications..."
  );

  setApprovalLoading(
    ownerApprovalCards,
    "Loading vehicle-owner applications..."
  );

  try {

    const [
      enforcers,
      owners
    ] = await Promise.all([
      apiRequest(
        "/admin/enforcers?status=pending"
      ),

      apiRequest(
        "/admin/owners?status=pending"
      )
    ]);

    pendingEnforcersV2 =
      Array.isArray(enforcers)
        ? enforcers
        : [];

    pendingOwnersV2 =
      Array.isArray(owners)
        ? owners
        : [];

    renderEnforcerApprovalCardsV2(
      pendingEnforcersV2
    );

    renderOwnerApprovalCardsV2(
      pendingOwnersV2
    );

    updateApprovalCountersV2();

  } catch (error) {

    console.error(
      "Account approvals error:",
      error
    );

    setApprovalEmpty(
      enforcerApprovalCards,
      "Unable to load applications",
      error.message ||
      "Please try refreshing the page."
    );

    setApprovalEmpty(
      ownerApprovalCards,
      "Unable to load applications",
      error.message ||
      "Please try refreshing the page."
    );

    showToast(
      error.message ||
      "Failed to load account applications.",
      "error"
    );
  }
}

/* =========================================================
   ENFORCER CARDS
========================================================= */

function renderEnforcerApprovalCardsV2(
  enforcers
) {

  if (!enforcerApprovalCards) {
    return;
  }

  if (!enforcers.length) {

    setApprovalEmpty(
      enforcerApprovalCards,
      "No pending enforcer applications",
      "All Traffic Enforcer registrations have been reviewed."
    );

    return;
  }

  enforcerApprovalCards.innerHTML =
    enforcers.map((enforcer) => {

      const validGmail =
        isValidGmailAddress(
          enforcer.email
        );

      return `
        <article class="approval-application-card">

          <div class="approval-card-header">

            <div class="approval-applicant-avatar">

              ${escapeHtml(
                getApplicantInitial(
                  enforcer.fullName
                )
              )}

            </div>

            <div class="approval-card-title">

              <h3>
                ${escapeHtml(
                  enforcer.fullName ||
                  "Unnamed Applicant"
                )}
              </h3>

              <p>
                Traffic Enforcer Applicant
              </p>

            </div>

            <span class="approval-card-status">
              Pending
            </span>

          </div>

          <div class="approval-card-details">

            <div class="approval-detail-row">

              <span>
                Email
              </span>

              <strong>
                ${escapeHtml(
                  enforcer.email || "—"
                )}
              </strong>

            </div>

            <div class="approval-detail-row">

              <span>
                Email Check
              </span>

              <strong>

                <span class="email-check-badge ${
                  validGmail
                    ? "valid"
                    : "invalid"
                }">

                  <i class="fa-solid ${
                    validGmail
                      ? "fa-circle-check"
                      : "fa-triangle-exclamation"
                  }"></i>

                  ${
                    validGmail
                      ? "Valid Gmail"
                      : "Check Format"
                  }

                </span>

              </strong>

            </div>

            <div class="approval-detail-row">

              <span>
                Badge Number
              </span>

              <strong class="mono">
                ${escapeHtml(
                  enforcer.badgeNumber || "—"
                )}
              </strong>

            </div>

            <div class="approval-detail-row">

              <span>
                Station
              </span>

              <strong>
                ${escapeHtml(
                  enforcer.station || "—"
                )}
              </strong>

            </div>

            <div class="approval-detail-row">

              <span>
                Submitted
              </span>

              <strong>
                ${escapeHtml(
                  formatDate(
                    enforcer.createdAt
                  )
                )}
              </strong>

            </div>

          </div>

          <div class="approval-card-actions">

            <button
              type="button"
              class="btn btn-outline btn-sm"
              onclick="rejectEnforcerApplicationV2('${enforcer._id}')"
            >

              <i class="fa-solid fa-xmark"></i>

              Reject

            </button>

            <button
              type="button"
              class="btn btn-amber btn-sm"
              onclick="approveEnforcerApplicationV2('${enforcer._id}')"
            >

              <i class="fa-solid fa-check"></i>

              Approve

            </button>

          </div>

        </article>
      `;
    }).join("");
}

/* =========================================================
   OWNER CARDS
========================================================= */

function renderOwnerApprovalCardsV2(
  owners
) {

  if (!ownerApprovalCards) {
    return;
  }

  if (!owners.length) {

    setApprovalEmpty(
      ownerApprovalCards,
      "No pending owner applications",
      "All Vehicle Owner registrations have been reviewed."
    );

    return;
  }

  ownerApprovalCards.innerHTML =
    owners.map((owner) => {

      return `
        <article class="approval-application-card">

          <div class="approval-card-header">

            <div class="approval-applicant-avatar owner-avatar">

              ${escapeHtml(
                getApplicantInitial(
                  owner.fullName
                )
              )}

            </div>

            <div class="approval-card-title">

              <h3>
                ${escapeHtml(
                  owner.fullName ||
                  "Unnamed Applicant"
                )}
              </h3>

              <p>
                Vehicle Owner Applicant
              </p>

            </div>

            <span class="approval-card-status">
              Pending
            </span>

          </div>

          <div class="approval-card-details">

            <div class="approval-detail-row">

              <span>
                Email
              </span>

              <strong>
                ${escapeHtml(
                  owner.email || "—"
                )}
              </strong>

            </div>

            <div class="approval-detail-row">

              <span>
                Credential
              </span>

              <strong>

                <span class="verified-badge">

                  <i class="fa-solid fa-circle-check"></i>

                  Submitted

                </span>

              </strong>

            </div>

            <div class="approval-detail-row">

              <span>
                Plate Number
              </span>

              <strong>

                <span class="plate-chip">
                  ${escapeHtml(
                    owner.plateNumber || "—"
                  )}
                </span>

              </strong>

            </div>

            <div class="approval-detail-row">

              <span>
                Submitted
              </span>

              <strong>
                ${escapeHtml(
                  formatDate(
                    owner.createdAt
                  )
                )}
              </strong>

            </div>

          </div>

          <div class="approval-card-actions">

            <button
              type="button"
              class="btn btn-outline btn-sm"
              onclick="viewOwnerApplicationDetails('${owner._id}')"
            >

              <i class="fa-solid fa-eye"></i>

              View Details

            </button>

            <button
              type="button"
              class="btn btn-outline btn-sm"
              onclick="rejectOwnerApplicationV2('${owner._id}')"
            >

              <i class="fa-solid fa-xmark"></i>

              Reject

            </button>

            <button
              type="button"
              class="btn btn-amber btn-sm"
              onclick="approveOwnerApplicationV2('${owner._id}')"
            >

              <i class="fa-solid fa-check"></i>

              Approve

            </button>

          </div>

        </article>
      `;
    }).join("");
}

/* =========================================================
   APPROVE / REJECT ENFORCER
========================================================= */

async function approveEnforcerApplicationV2(
  enforcerId
) {

  try {

    await apiRequest(
      `/admin/enforcers/${enforcerId}/approve`,
      {
        method: "PATCH"
      }
    );

    showToast(
      "Enforcer approved."
    );

    await refreshApprovalDataAfterActionV2();

  } catch (error) {

    showToast(
      error.message ||
      "Failed to approve enforcer.",
      "error"
    );
  }
}

function rejectEnforcerApplicationV2(
  enforcerId
) {

  openReasonModal({

    title:
      "Reject enforcer registration",

    sub:
      "The applicant will see the decision, and the reason if you give one, when signing in.",

    onConfirm: async (reason) => {

      try {

        await apiRequest(
          `/admin/enforcers/${enforcerId}/reject`,
          {
            method: "PATCH",
            body: {
              reason
            }
          }
        );

        showToast(
          "Enforcer registration rejected."
        );

        await refreshApprovalDataAfterActionV2();

      } catch (error) {

        showToast(
          error.message ||
          "Failed to reject enforcer.",
          "error"
        );
      }
    }
  });
}

/* =========================================================
   APPROVE / REJECT OWNER
========================================================= */

async function approveOwnerApplicationV2(
  ownerId
) {

  try {

    await apiRequest(
      `/admin/owners/${ownerId}/approve`,
      {
        method: "PATCH"
      }
    );

    showToast(
      "Vehicle owner approved."
    );

    await refreshApprovalDataAfterActionV2();

  } catch (error) {

    showToast(
      error.message ||
      "Failed to approve owner.",
      "error"
    );
  }
}

function rejectOwnerApplicationV2(
  ownerId
) {

  openReasonModal({

    title:
      "Reject vehicle-owner registration",

    sub:
      "Provide an optional reason for the administrator record.",

    onConfirm: async (reason) => {

      try {

        await apiRequest(
          `/admin/owners/${ownerId}/reject`,
          {
            method: "PATCH",
            body: {
              reason
            }
          }
        );

        showToast(
          "Vehicle-owner registration rejected."
        );

        await refreshApprovalDataAfterActionV2();

      } catch (error) {

        showToast(
          error.message ||
          "Failed to reject owner.",
          "error"
        );
      }
    }
  });
}

/* Make card onclick functions globally available */

window.approveEnforcerApplicationV2 =
  approveEnforcerApplicationV2;

window.rejectEnforcerApplicationV2 =
  rejectEnforcerApplicationV2;

window.approveOwnerApplicationV2 =
  approveOwnerApplicationV2;

window.rejectOwnerApplicationV2 =
  rejectOwnerApplicationV2;

/* =========================================================
   SEARCH
========================================================= */

enforcerApprovalSearch?.addEventListener(
  "input",
  () => {

    const query =
      enforcerApprovalSearch.value
        .trim()
        .toLowerCase();

    const filtered =
      pendingEnforcersV2.filter(
        (enforcer) => {

          const searchableText = [
            enforcer.fullName,
            enforcer.email,
            enforcer.badgeNumber,
            enforcer.station
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            query
          );
        }
      );

    renderEnforcerApprovalCardsV2(
      filtered
    );
  }
);

ownerApprovalSearch?.addEventListener(
  "input",
  () => {

    const query =
      ownerApprovalSearch.value
        .trim()
        .toLowerCase();

    const filtered =
      pendingOwnersV2.filter(
        (owner) => {

          const searchableText = [
            owner.fullName,
            owner.email,
            owner.plateNumber
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            query
          );
        }
      );

    renderOwnerApprovalCardsV2(
      filtered
    );
  }
);

/* =========================================================
   REFRESH BUTTONS
========================================================= */

refreshEnforcerApprovals?.addEventListener(
  "click",
  async () => {

    refreshEnforcerApprovals.disabled =
      true;

    refreshEnforcerApprovals.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Refreshing
    `;

    await loadAccountApprovalsV2();

    refreshEnforcerApprovals.disabled =
      false;

    refreshEnforcerApprovals.innerHTML = `
      <i class="fa-solid fa-rotate"></i>
      Refresh
    `;
  }
);

refreshOwnerApprovals?.addEventListener(
  "click",
  async () => {

    refreshOwnerApprovals.disabled =
      true;

    refreshOwnerApprovals.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Refreshing
    `;

    await loadAccountApprovalsV2();

    refreshOwnerApprovals.disabled =
      false;

    refreshOwnerApprovals.innerHTML = `
      <i class="fa-solid fa-rotate"></i>
      Refresh
    `;
  }
);

/* =========================================================
   REFRESH AFTER ACTION
========================================================= */

async function refreshApprovalDataAfterActionV2() {

  await loadAccountApprovalsV2();

  try {

    const stats =
      await apiRequest(
        "/admin/stats"
      );

    updateSidebarCounts(stats);

    if (
      typeof updateExecutiveSummary ===
      "function"
    ) {

      updateExecutiveSummary(stats);
    }

    if (
      typeof updateAdminNotificationCenter ===
      "function"
    ) {

      updateAdminNotificationCenter(stats);
    }

  } catch (error) {

    console.error(
      "Approval counter refresh error:",
      error
    );
  }
}

/* =========================================================
   INITIAL VIEW (restore from URL hash on refresh)
========================================================= */
// Runs last, after switchView()'s dependencies (updateDashboardBackButton,
// loadViewData, etc.) are all declared above.

(function restoreInitialView() {

  const requestedView =
    window.location.hash.replace("#", "");

  const validViewIds =
    Array.from(views).map((v) => v.id.replace("view-", ""));

  if (requestedView && validViewIds.includes(requestedView)) {
    switchView(requestedView);
  } else {
    switchView("overview");
  }

})();


