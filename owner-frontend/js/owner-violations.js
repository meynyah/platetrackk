// ==========================================
// PlateTrack | Owner Violations
// ==========================================

// API_BASE comes from shared/js/config.js (loaded before this file).

let allViolations = [];
let allAppeals = [];
let ownerViolationsCurrentPage = 1;
let ownerViolationsTotalPages = 1;
const OWNER_VIOLATIONS_PAGE_SIZE = 20;

document.addEventListener("DOMContentLoaded", async function(){

    const session = requireOwnerSession();

    if(!session){
        return;
    }

    await loadViolations(session.token);

});

// ==========================================
// SESSION HELPERS
// ==========================================

function requireOwnerSession(){

    const token = localStorage.getItem("plateTrackOwnerToken");
    const storedUser = localStorage.getItem("plateTrackOwnerUser");

    if(!token || !storedUser){

        window.location.href = "owner-login.html";
        return null;

    }

    try{

        const user = JSON.parse(storedUser);

        if(!user || user.role !== "owner"){
            throw new Error("Invalid owner session.");
        }

        return { token, user };

    }catch(error){

        clearOwnerSession();
        window.location.href = "owner-login.html";
        return null;

    }

}

function clearOwnerSession(){
    localStorage.removeItem("plateTrackOwnerToken");
    localStorage.removeItem("plateTrackOwnerUser");
    localStorage.removeItem("plateTrackOwnerSession");
}

// ==========================================
// API
// ==========================================

async function ownerApiRequest(endpoint, token, options = {}){

    const response = await fetch(
        API_BASE + endpoint,
        {
            ...options,
            headers:{
                "Content-Type":"application/json",
                "Authorization":`Bearer ${token}`,
                ...(options.headers || {})
            }
        }
    );

    let data = {};

    try{
        data = await response.json();
    }catch(error){
        data = {};
    }

    if(response.status === 401 || response.status === 403){

        clearOwnerSession();
        window.location.href = "owner-login.html";

        throw new Error(data.message || "Your session has expired. Please sign in again.");

    }

    if(!response.ok){
        throw new Error(data.message || "Unable to load your data.");
    }

    return data;

}

// ==========================================
// APPEAL LOOKUP HELPERS
// ==========================================

function appealViolationId(appeal){

    if(!appeal || !appeal.violation){
        return null;
    }

    return typeof appeal.violation === "object"
        ? appeal.violation._id
        : appeal.violation;

}

function findAppealForViolation(violationId){

    return allAppeals.find(function(appeal){
        return appealViolationId(appeal) === violationId;
    }) || null;

}

function appealStatusLabel(status){

    const labels = {
        submitted:"Pending",
        under_review:"Under Review",
        approved:"Approved",
        denied:"Denied"
    };

    return labels[status] || status;

}

function appealStatusClass(status){

    if(status === "approved"){
        return "approved";
    }

    if(status === "denied"){
        return "denied";
    }

    return "pending"; // submitted / under_review

}

// ==========================================
// LOAD VIOLATIONS (from backend)
// ==========================================

async function loadViolations(token, data = null, append = false){

    const historyList = document.getElementById("historyList");
    const emptyState = document.getElementById("emptyState");
    const loadMoreWrap = document.getElementById("loadMoreViolationsWrap");
    const loadMoreBtn = document.getElementById("loadMoreViolationsBtn");

    if(data === null){

        if(append){

            if(loadMoreBtn){
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = "Loading...";
            }

        }
        else{

            ownerViolationsCurrentPage = 1;

            emptyState.style.display = "none";

            if(loadMoreWrap){
                loadMoreWrap.style.display = "none";
            }

            historyList.innerHTML = `
                <div class="history-loading-state">
                    <div class="history-loading-spinner">
                        <i class="fa-solid fa-car-burst"></i>
                    </div>
                    <p>Loading your violations...</p>
                    <div class="history-loading-skeletons">
                        <div class="history-skeleton-card"></div>
                        <div class="history-skeleton-card"></div>
                        <div class="history-skeleton-card"></div>
                    </div>
                </div>
            `;

        }

        try{

            const [violationsResult, appeals] = await Promise.all([
                ownerApiRequest(`/owner/violations/mine?page=${ownerViolationsCurrentPage}&limit=${OWNER_VIOLATIONS_PAGE_SIZE}`, token),
                ownerApiRequest("/owner/appeals/mine", token)
            ]);

            const newViolations = Array.isArray(violationsResult?.violations) ? violationsResult.violations : [];
            ownerViolationsTotalPages = violationsResult?.totalPages || 1;

            allViolations = append ? allViolations.concat(newViolations) : newViolations;
            allAppeals = Array.isArray(appeals) ? appeals : [];

            if(loadMoreWrap && loadMoreBtn){

                if(ownerViolationsCurrentPage < ownerViolationsTotalPages){
                    loadMoreWrap.style.display = "block";
                    loadMoreBtn.disabled = false;
                    loadMoreBtn.textContent = "Load More";
                }
                else{
                    loadMoreWrap.style.display = "none";
                }

            }

        }
        catch(error){

            console.error("Unable to load violations:", error);

            historyList.innerHTML = "";
            emptyState.style.display = "flex";

            const heading = emptyState.querySelector("h3");
            const paragraph = emptyState.querySelector("p");

            if(heading){
                heading.textContent = "Unable to Load Violations";
            }

            if(paragraph){
                paragraph.textContent = error.message || "Please refresh the page.";
            }

            return;

        }

    }

    const violations = data !== null ? data : allViolations;

    historyList.innerHTML = "";

    if(violations.length === 0){

        emptyState.style.display = "flex";

        return;

    }

    emptyState.style.display = "none";

    violations.forEach(function(item){

        const appeal = findAppealForViolation(item._id);

        let appealSection = "";

        if(appeal){

            appealSection = `
                <div class="detail-row">
                    <span class="detail-label">Appeal Status</span>
                    <span class="appeal-badge ${appealStatusClass(appeal.status)}">${escapeHtml(appealStatusLabel(appeal.status))}</span>
                </div>
            `;

        }

        const date = item.dateTime
            ? new Date(item.dateTime).toLocaleString("en-PH",{
                month:"short",
                day:"numeric",
                year:"numeric",
                hour:"numeric",
                minute:"2-digit"
            })
            : "-";

        historyList.innerHTML += `
            <div class="history-card">

                <div class="history-header">

                    <div>
                        <div class="record-id">
                            ${escapeHtml((item._id || "").slice(-8).toUpperCase() || "N/A")}
                        </div>

                        <div class="plate-number">
                            ${escapeHtml(item.plateNumber || "Unknown Plate")}
                        </div>
                    </div>

                    <div class="violation-badge">
                        ${escapeHtml(item.violationType || "Violation")}
                    </div>

                </div>

                <div class="history-details">

                    <div class="detail-row">
                        <span class="detail-label">Location</span>
                        <span class="detail-value">${escapeHtml(item.location || "-")}</span>
                    </div>

                    <div class="detail-row">
                        <span class="detail-label">Date</span>
                        <span class="detail-value">${escapeHtml(date)}</span>
                    </div>

                    ${appealSection}

                </div>

                <div class="card-actions">

                    <button
                    class="view-btn"
                    type="button"
                    onclick="viewRecord('${item._id}')">

                        <i class="fa-solid fa-eye"></i>
                        View

                    </button>

                </div>

                ${appeal ? "" : `
                    <button
                    class="appeal-btn"
                    type="button"
                    onclick="startAppeal('${item._id}')">

                        <i class="fa-solid fa-file-pen"></i>
                        File an Appeal

                    </button>
                `}

            </div>
        `;

    });

}

// ==========================================
// SEARCH + FILTER
// ==========================================

function loadMoreOwnerViolations(){

    if(ownerViolationsCurrentPage >= ownerViolationsTotalPages){
        return;
    }

    ownerViolationsCurrentPage += 1;

    const token = localStorage.getItem("plateTrackOwnerToken");
    loadViolations(token, null, true);

}

function applyFilters(){

    const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
    const filter = document.getElementById("appealFilter").value;

    const filtered = allViolations.filter(function(item){

        const plate = (item.plateNumber || "").toLowerCase();

        const matchKeyword = plate.includes(keyword);

        const appeal = findAppealForViolation(item._id);

        let matchFilter = true;

        if(filter === "none"){
            matchFilter = !appeal;
        }
        else if(filter === "Pending"){
            matchFilter = !!appeal && (appeal.status === "submitted" || appeal.status === "under_review");
        }
        else if(filter === "Approved"){
            matchFilter = !!appeal && appeal.status === "approved";
        }
        else if(filter === "Denied"){
            matchFilter = !!appeal && appeal.status === "denied";
        }

        return matchKeyword && matchFilter;

    });

    const token = localStorage.getItem("plateTrackOwnerToken");

    loadViolations(token, filtered);

}

// ==========================================
// FILE APPEAL
// ==========================================

function startAppeal(violationId){

    localStorage.setItem("plateTrackCurrentAppealViolationId", violationId);

    window.location.href = "appeal-form.html";

}

// ==========================================
// VIEW RECORD
// ==========================================

function viewRecord(violationId){

    const item = allViolations.find(function(record){
        return record._id === violationId;
    });

    if(!item){
        return;
    }

    const imageBox = document.getElementById("capturedDetailImage");

    if(item.photoUrl){

        imageBox.innerHTML = `
            <img
            src="${item.photoUrl}"
            alt="Captured vehicle evidence">
        `;

    }
    else{

        imageBox.innerHTML = `
            <div class="no-image-box">
                <i class="fa-solid fa-camera"></i>
                <p>No captured image available</p>
            </div>
        `;

    }

    const date = item.dateTime
        ? new Date(item.dateTime).toLocaleString("en-PH",{
            month:"long",
            day:"numeric",
            year:"numeric",
            hour:"numeric",
            minute:"2-digit"
        })
        : "-";

    document.getElementById("detailRecordId").textContent = (item._id || "").slice(-8).toUpperCase() || "N/A";
    document.getElementById("detailPlate").textContent = item.plateNumber || "-";
    document.getElementById("detailVehicle").textContent = item.vehicleType || "-";
    document.getElementById("detailColor").textContent = item.vehicleColor || "-";
    document.getElementById("detailViolation").textContent = item.violationType || "-";
    document.getElementById("detailLocation").textContent = item.location || "-";
    document.getElementById("detailDate").textContent = date;

    document.getElementById("detailNotes").textContent =
    item.notes && item.notes.trim() !== ""
    ? item.notes
    : "No additional remarks.";

    const appeal = findAppealForViolation(item._id);
    const appealSection = document.getElementById("detailAppealSection");

    if(appeal){

        appealSection.innerHTML = `
            <div class="detail-item">
                <span>Appeal Reason</span>
                <strong>${escapeHtml(appeal.reason)}</strong>
            </div>
            <div class="detail-item">
                <span>Explanation</span>
                <strong>${escapeHtml(appeal.supportingDetails || "No additional explanation was provided.")}</strong>
            </div>
            <div class="detail-item">
                <span>Appeal Status</span>
                <strong>${escapeHtml(appealStatusLabel(appeal.status))}</strong>
            </div>
            ${appeal.adminFeedback ? `
                <div class="detail-item">
                    <span>Admin Feedback</span>
                    <strong>${escapeHtml(appeal.adminFeedback)}</strong>
                </div>
            ` : ""}
        `;

    }
    else{

        appealSection.innerHTML = "";

    }

    document.getElementById("detailsModal").style.display = "flex";

}

function closeDetailsModal(){

    document.getElementById("detailsModal").style.display = "none";

}

window.addEventListener("click", function(event){

    const modal = document.getElementById("detailsModal");

    if(event.target === modal){

        closeDetailsModal();

    }

});

// ==========================================
// SAFE HTML
// ==========================================

function escapeHtml(value){
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
