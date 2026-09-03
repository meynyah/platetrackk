// ==========================================
// PLATETRACK
// ENFORCER HISTORY PAGE — MONGODB VERSION
// ==========================================

// API_BASE comes from shared/js/config.js (loaded before this file).
const HISTORY_API_URL = `${API_BASE}/enforcer/violations/mine`;

let historyRecords = [];
let historyCurrentPage = 1;
let historyTotalPages = 1;
const HISTORY_PAGE_SIZE = 20;

// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

    protectHistoryPage();
    loadHistory();

});

// ==========================================
// SESSION PROTECTION
// ==========================================

function protectHistoryPage() {

    const token =
        localStorage.getItem("plateTrackToken");

    const session =
        localStorage.getItem("plateTrackEnforcerSession");

    if (!token || !session) {

        window.location.replace(
            "enforcer-login.html"
        );

        return false;
    }

    return true;
}

window.addEventListener("pageshow", function () {

    if (!localStorage.getItem("plateTrackToken")) {

        window.location.replace(
            "enforcer-login.html"
        );
    }

});

// ==========================================
// LOAD HISTORY FROM MONGODB
// ==========================================

async function loadHistory(append = false) {

    const historyList =
        document.getElementById("historyList");

    const emptyState =
        document.getElementById("emptyState");

    const loadMoreWrap =
        document.getElementById("loadMoreHistoryWrap");

    const loadMoreBtn =
        document.getElementById("loadMoreHistoryBtn");

    if (!historyList || !emptyState) {
        return;
    }

    const token =
        localStorage.getItem("plateTrackToken");

    if (!token) {

        window.location.replace(
            "enforcer-login.html"
        );

        return;
    }

    if (append) {

        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = "Loading...";
        }

    } else {

        historyCurrentPage = 1;

        historyList.innerHTML = `
            <div class="history-loading-state">
                <div class="history-loading-spinner">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                </div>
                <p>Loading violation history...</p>
                <div class="history-loading-skeletons">
                    <div class="history-skeleton-card"></div>
                    <div class="history-skeleton-card"></div>
                    <div class="history-skeleton-card"></div>
                </div>
            </div>
        `;

        emptyState.style.display = "none";

        if (loadMoreWrap) {
            loadMoreWrap.style.display = "none";
        }

    }

    try {

        const response = await fetch(
            `${HISTORY_API_URL}?page=${historyCurrentPage}&limit=${HISTORY_PAGE_SIZE}`,
            {
                method: "GET",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        let result = null;

        try {

            result = await response.json();

        } catch (error) {

            result = null;
        }

        if (response.status === 401) {

            localStorage.removeItem(
                "plateTrackToken"
            );

            localStorage.removeItem(
                "plateTrackEnforcerSession"
            );

            window.location.replace(
                "enforcer-login.html"
            );

            return;
        }

        if (!response.ok) {

            throw new Error(
                result?.message ||
                "Unable to load violation history."
            );
        }

        const newViolations =
            Array.isArray(result?.violations)
                ? result.violations
                : [];

        historyTotalPages = result?.totalPages || 1;

        historyRecords = append
            ? historyRecords.concat(newViolations)
            : newViolations;

        historyRecords.sort(function (a, b) {

            return new Date(
                b.dateTime || b.createdAt
            ) - new Date(
                a.dateTime || a.createdAt
            );
        });

        renderHistory(historyRecords);

        if (loadMoreWrap && loadMoreBtn) {

            if (historyCurrentPage < historyTotalPages) {
                loadMoreWrap.style.display = "block";
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = "Load More";
            } else {
                loadMoreWrap.style.display = "none";
            }

        }

    } catch (error) {

        console.error(
            "History loading error:",
            error
        );

        historyList.innerHTML = "";

        emptyState.style.display = "flex";

        showError(
            "Unable to Load History",
            error.message ||
            "Please check your connection and try again."
        );
    }
}

// ==========================================
// RENDER HISTORY
// ==========================================

function renderHistory(history) {

    const historyList =
        document.getElementById("historyList");

    const emptyState =
        document.getElementById("emptyState");

    historyList.innerHTML = "";

    if (!history.length) {

        emptyState.style.display = "flex";

        return;
    }

    emptyState.style.display = "none";

    history.forEach(function (item) {

        const databaseId =
            item._id || "";

        const recordId =
            createDisplayRecordId(databaseId);

        const plateNumber =
            escapeHistoryHtml(
                item.plateNumber ||
                "Unknown Plate"
            );

        const violationType =
            escapeHistoryHtml(
                item.violationType ||
                "Violation"
            );

        const location =
            escapeHistoryHtml(
                item.location ||
                "Antipolo City"
            );

        const date =
            formatHistoryDate(
                item.dateTime ||
                item.createdAt
            );

        const status =
            escapeHistoryHtml(
                item.status ||
                "pending"
            );

        historyList.innerHTML += `
            <div class="history-card">

                <div class="history-header">

                    <div>

                        <div class="record-id">
                            ${recordId}
                        </div>

                        <div class="plate-number">
                            ${plateNumber}
                        </div>

                    </div>

                    <div class="violation-badge">
                        ${violationType}
                    </div>

                </div>

                <div class="history-details">

                    <div class="detail-row">
                        <span class="detail-label">
                            Status
                        </span>

                        <span class="detail-value">
                            ${formatStatus(status)}
                        </span>
                    </div>

                    <div class="detail-row">
                        <span class="detail-label">
                            Location
                        </span>

                        <span class="detail-value">
                            ${location}
                        </span>
                    </div>

                    <div class="detail-row">
                        <span class="detail-label">
                            Date
                        </span>

                        <span class="detail-value">
                            ${date}
                        </span>
                    </div>

                </div>

                <div class="card-actions">

                    <button
                        class="view-btn"
                        type="button"
                        onclick="viewRecord('${databaseId}')"
                    >

                        <i class="fa-solid fa-eye"></i>
                        View

                    </button>

                </div>

            </div>
        `;
    });
}

// ==========================================
// SEARCH AND FILTER
// ==========================================

function applyFilters() {

    const searchInput =
        document.getElementById("searchInput");

    const violationFilter =
        document.getElementById(
            "violationFilter"
        );

    const keyword =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";

    const filter =
        violationFilter
            ? violationFilter.value
            : "";

    const filteredHistory =
        historyRecords.filter(function (item) {

            const plate =
                String(
                    item.plateNumber || ""
                ).toLowerCase();

            const location =
                String(
                    item.location || ""
                ).toLowerCase();

            const recordId =
                createDisplayRecordId(
                    item._id
                ).toLowerCase();

            const violation =
                String(
                    item.violationType || ""
                );

            const notes =
                String(
                    item.notes || ""
                ).toLowerCase();

            const matchKeyword =
                plate.includes(keyword) ||
                location.includes(keyword) ||
                recordId.includes(keyword) ||
                violation
                    .toLowerCase()
                    .includes(keyword) ||
                notes.includes(keyword);

            const matchViolation =
                !filter ||
                violation === filter;

            return (
                matchKeyword &&
                matchViolation
            );
        });

    renderHistory(filteredHistory);
}

// ==========================================
// VIEW RECORD
// ==========================================

function viewRecord(databaseId) {

    const item =
        historyRecords.find(function (record) {

            return record._id === databaseId;
        });

    if (!item) {

        showError(
            "Record Not Found",
            "The selected violation record could not be found."
        );

        return;
    }

    const imageBox =
        document.getElementById(
            "capturedDetailImage"
        );

    if (imageBox) {

        if (item.photoUrl) {

            imageBox.innerHTML = `
                <img
                    src="${escapeHistoryHtml(item.photoUrl)}"
                    alt="Captured vehicle evidence"
                >
            `;

        } else {

            imageBox.innerHTML = `
                <div class="no-image-box">

                    <i class="fa-solid fa-camera"></i>

                    <p>
                        No captured image available
                    </p>

                </div>
            `;
        }
    }

    setTextContent(
        "detailRecordId",
        createDisplayRecordId(item._id)
    );

    setTextContent(
        "detailPlate",
        item.plateNumber || "-"
    );

    setTextContent(
        "detailVehicle",
        item.vehicleType || "-"
    );

    setTextContent(
        "detailColor",
        item.vehicleColor || "-"
    );

    setTextContent(
        "detailViolation",
        item.violationType || "-"
    );

    setTextContent(
        "detailLocation",
        item.location || "-"
    );

    setTextContent(
        "detailDate",
        formatHistoryDate(
            item.dateTime ||
            item.createdAt
        )
    );

    setTextContent(
        "detailNotes",
        item.notes &&
        item.notes.trim() !== ""
            ? item.notes
            : "No additional remarks."
    );

    const detailsModal =
        document.getElementById(
            "detailsModal"
        );

    if (detailsModal) {

        detailsModal.style.display = "flex";
    }
}

// ==========================================
// CLOSE DETAILS MODAL
// ==========================================

function closeDetailsModal() {

    const modal =
        document.getElementById(
            "detailsModal"
        );

    if (modal) {

        modal.style.display = "none";
    }
}

// ==========================================
// REFRESH HISTORY
// ==========================================

function refreshHistory() {

    loadHistory();
}

function loadMoreHistory() {

    if (historyCurrentPage >= historyTotalPages) {
        return;
    }

    historyCurrentPage += 1;
    loadHistory(true);
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function createDisplayRecordId(databaseId) {

    if (!databaseId) {
        return "N/A";
    }

    const shortenedId =
        String(databaseId)
            .slice(-8)
            .toUpperCase();

    return `PT-${shortenedId}`;
}

function formatHistoryDate(dateValue) {

    if (!dateValue) {
        return "-";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat(
        "en-PH",
        {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }
    ).format(date);
}

function formatStatus(status) {

    const value =
        String(status || "pending");

    return value
        .replace(/_/g, " ")
        .replace(/\b\w/g, function (letter) {

            return letter.toUpperCase();
        });
}

function setTextContent(id, value) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent = value;
    }
}

function escapeHistoryHtml(value) {

    return String(
        value === null ||
        value === undefined
            ? ""
            : value
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// CLOSE MODAL WHEN CLICKING OUTSIDE
// ==========================================

window.addEventListener(
    "click",
    function (event) {

        const modal =
            document.getElementById(
                "detailsModal"
            );

        if (
            modal &&
            event.target === modal
        ) {

            closeDetailsModal();
        }
    }
);