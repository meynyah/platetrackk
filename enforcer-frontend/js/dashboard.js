// API_BASE comes from shared/js/config.js (loaded before this file).
const DASHBOARD_API_URL = `${API_BASE}/enforcer/violations/mine`;

let enforcerNotificationsCache = [];

function protectEnforcerDashboard() {
    const token = localStorage.getItem("plateTrackToken");
    const session = localStorage.getItem("plateTrackEnforcerSession");

    if (!token || !session) {
        window.location.replace("enforcer-login.html");
        return false;
    }

    return true;
}

function loadEnforcerSession() {
    const savedSession = localStorage.getItem("plateTrackEnforcerSession");

    if (!savedSession) {
        window.location.href = "enforcer-login.html";
        return;
    }

    try {
        const enforcer = JSON.parse(savedSession);

        const nameElement = document.getElementById("enforcerName");
        const badgeElement = document.getElementById("badgeNumber");

        if (nameElement) {
            nameElement.textContent =
                enforcer.fullName || "Traffic Enforcer";
        }

        if (badgeElement) {
            badgeElement.textContent =
                enforcer.badgeNumber || "No badge number";
        }
    } catch (error) {
        console.error("Invalid enforcer session:", error);

        localStorage.removeItem("plateTrackEnforcerSession");
        localStorage.removeItem("plateTrackToken");

        window.location.href = "enforcer-login.html";
    }
}

// ==========================================
// PLATETRACK DASHBOARD
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    if (!protectEnforcerDashboard()) {
        return;
    }

    loadEnforcerSession();
    updateDateTime();
    updateGreeting();
    loadDashboardData();
    loadEnforcerNotifications();
    loadDutyStatus();

    setInterval(updateDateTime,1000);

});

async function fetchEnforcerViolations(){

    const token = localStorage.getItem("plateTrackToken");

    if(!token){
        return { violations: [], totalCount: 0 };
    }

    try{

        // The backend now paginates this endpoint -- request a large
        // enough page (100, the backend's max) so the dashboard's
        // summary counts and "Recent Detections" list stay accurate for
        // the typical enforcer. totalCount below always reflects the
        // true total regardless of page size.
        const response = await fetch(
            `${DASHBOARD_API_URL}?page=1&limit=100`,
            {
                method:"GET",
                headers:{
                    "Content-Type":"application/json",
                    "Authorization":`Bearer ${token}`
                }
            }
        );

        if(response.status === 401){
            localStorage.removeItem("plateTrackToken");
            localStorage.removeItem("plateTrackEnforcerSession");
            window.location.replace("enforcer-login.html");
            return { violations: [], totalCount: 0 };
        }

        if(!response.ok){
            return { violations: [], totalCount: 0 };
        }

        const data = await response.json();

        return {
            violations: Array.isArray(data?.violations) ? data.violations : [],
            totalCount: typeof data?.totalCount === "number" ? data.totalCount : 0,
        };

    }
    catch(error){

        console.error("Unable to load your reports:",error);

        return { violations: [], totalCount: 0 };

    }

}

function escapeHtml(value){
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function updateDateTime(){

    const now = new Date();

    document.getElementById("todayDate").textContent =
    now.toLocaleDateString("en-US",{
        year:"numeric",
        month:"long",
        day:"numeric"
    });

    document.getElementById("liveTime").textContent =
    now.toLocaleTimeString("en-US",{
        hour:"numeric",
        minute:"2-digit",
        second:"2-digit",
        hour12:true
    });

}

function updateGreeting(){

    const hour = new Date().getHours();
    const greeting = document.getElementById("greeting");

    if(hour < 12){
        greeting.innerHTML = "Good Morning ☀️";
    }
    else if(hour < 18){
        greeting.innerHTML = "Good Afternoon 🌤";
    }
    else{
        greeting.innerHTML = "Good Evening 🌙";
    }

}

function toggleMenu(){

    const menu = document.getElementById("headerMenu");

    menu.style.display =
    menu.style.display === "block" ? "none" : "block";

}

window.addEventListener("click",function(e){

    if(!e.target.closest(".menu-wrapper")){

        const menu = document.getElementById("headerMenu");

        if(menu){
            menu.style.display = "none";
        }

    }

});

function startDetection(){

    showSuccess(
        "Opening Camera",
        "The camera will now open for license plate detection."
    );

    setTimeout(function(){
        window.location.href = "camera.html";
    },1000);

}

// ==========================================
// NOTIFICATIONS
// ==========================================

async function fetchEnforcerNotifications(){

    const token = localStorage.getItem("plateTrackToken");

    if(!token){
        return [];
    }

    try{

        const response = await fetch(
            `${API_BASE}/enforcer/notifications`,
            {
                method:"GET",
                headers:{
                    "Content-Type":"application/json",
                    "Authorization":`Bearer ${token}`
                }
            }
        );

        if(response.status === 401){
            localStorage.removeItem("plateTrackToken");
            localStorage.removeItem("plateTrackEnforcerSession");
            window.location.replace("enforcer-login.html");
            return [];
        }

        if(!response.ok){
            return [];
        }

        const data = await response.json();

        return Array.isArray(data) ? data : [];

    }
    catch(error){

        console.error("Unable to load notifications:", error);

        return [];

    }

}

function renderNotificationBadge(){

    const badge = document.getElementById("notificationCount");

    if(!badge){
        return;
    }

    const unreadCount = enforcerNotificationsCache.filter(function(item){
        return !item.read;
    }).length;

    if(unreadCount === 0){
        badge.style.display = "none";
    }else{
        badge.style.display = "flex";
        badge.textContent = unreadCount;
    }

}

function formatNotificationDate(dateStr){

    if(!dateStr){
        return "";
    }

    const date = new Date(dateStr);

    if(Number.isNaN(date.getTime())){
        return "";
    }

    return date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });

}

function renderNotificationList(){

    const list = document.getElementById("notificationList");

    if(!list){
        return;
    }

    if(enforcerNotificationsCache.length === 0){

        list.innerHTML = `
            <div class="notification-item simple">
                <i class="fa-solid fa-circle-info"></i>
                <span>No new notifications.</span>
            </div>
        `;

        return;
    }

    list.innerHTML = enforcerNotificationsCache.map(function(item){

        return `
            <div
            class="notification-item${item.read ? "" : " unread"}"
            onclick="markEnforcerNotificationRead('${item._id}')">

                <div class="notification-item-icon">
                    <i class="fa-solid ${item.read ? "fa-circle-info" : "fa-triangle-exclamation"}"></i>
                </div>

                <div class="notification-item-body">
                    <strong>${escapeHtml(item.title || "Notification")}</strong>
                    <span class="notification-item-message">${escapeHtml(item.message || "")}</span>
                    <span class="notification-item-time">${escapeHtml(formatNotificationDate(item.createdAt))}</span>
                </div>

            </div>
        `;

    }).join("");

}

async function markEnforcerNotificationRead(id){

    const target = enforcerNotificationsCache.find(function(item){
        return item._id === id;
    });

    if(!target || target.read){
        return;
    }

    // Update immediately so the modal feels responsive, then confirm with
    // the server.
    target.read = true;
    renderNotificationBadge();
    renderNotificationList();

    const token = localStorage.getItem("plateTrackToken");

    try{

        await fetch(
            `${API_BASE}/enforcer/notifications/${id}/read`,
            {
                method:"PATCH",
                headers:{
                    "Content-Type":"application/json",
                    "Authorization":`Bearer ${token}`
                }
            }
        );

    }catch(error){

        console.error("Failed to mark notification as read:", error);

    }

}

async function loadEnforcerNotifications(){

    enforcerNotificationsCache = await fetchEnforcerNotifications();

    renderNotificationBadge();
    renderNotificationList();

}

function openNotificationModal(){

    document.getElementById("notificationModal").style.display = "flex";

    // Refresh in case something new arrived since the dashboard loaded.
    loadEnforcerNotifications();

}

function closeNotificationModal(){

    document.getElementById("notificationModal").style.display = "none";

}

window.markEnforcerNotificationRead = markEnforcerNotificationRead;

function confirmLogout(){

    showConfirm(
        "Logout",
        "Are you sure you want to logout?",
        function(){

            localStorage.removeItem("plateTrackToken");
            localStorage.removeItem("plateTrackEnforcerSession");

            window.location.replace("enforcer-login.html");

        }
    );

}

async function loadDashboardData(){

    const result = await fetchEnforcerViolations();
    const violations = result.violations;
    const totalCount = result.totalCount;

    const vehicleCountEl = document.getElementById("vehicleCount");
    const violationCountEl = document.getElementById("violationCount");
    const pendingReportsEl = document.getElementById("pendingReports");

    vehicleCountEl.textContent = totalCount;
    vehicleCountEl.classList.remove("is-loading");

    violationCountEl.textContent = totalCount;
    violationCountEl.classList.remove("is-loading");

    const pending = violations.filter(function(item){
        return item.status === "pending";
    });

    pendingReportsEl.textContent = pending.length;
    pendingReportsEl.classList.remove("is-loading");

    loadRecentDetections(violations);

}

function loadRecentDetections(violations){

    const container = document.getElementById("recentDetection");

    container.innerHTML = "";

    if(violations.length === 0){

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fa-solid fa-car"></i>
                </div>
                <h3>No Recent Detection</h3>
                <p>No submitted violation reports found yet.</p>
            </div>
        `;

        return;
    }

    const recent = violations.slice(0,3);

    recent.forEach(function(item){

        const plate = item.plateNumber || "Unknown Plate";
        const vehicle = item.vehicleType || "Unknown Vehicle";
        const color = item.vehicleColor || "Unknown Color";
        const violation = item.violationType || "Violation Recorded";
        const location = item.location || "Unknown Location";

        const date = item.dateTime
            ? new Date(item.dateTime).toLocaleString("en-US",{
                month:"short",
                day:"numeric",
                year:"numeric",
                hour:"numeric",
                minute:"2-digit"
            })
            : "Recent";

        container.innerHTML += `
            <div class="detection-card">

                <div class="plate-icon">
                    <i class="fa-solid fa-car"></i>
                </div>

                <div class="plate-details">
                    <h3>${escapeHtml(plate)}</h3>
                    <p>${escapeHtml(vehicle)} • ${escapeHtml(color)}</p>
                    <small>${escapeHtml(violation)}</small>
                    <small>${escapeHtml(location)}</small>
                </div>

                <span class="time-badge">
                    ${escapeHtml(date)}
                </span>

            </div>
        `;

    });

}

window.addEventListener("pageshow", (event) => {

    const token = localStorage.getItem("plateTrackToken");
    const session = localStorage.getItem("plateTrackEnforcerSession");

    if (event.persisted || !token || !session) {
        window.location.replace("enforcer-login.html");
    }

});

// ==========================================
// DUTY STATUS (real, backend-enforced -- not just a display badge)
// ==========================================

function renderDutyStatus(onDuty){

    const toggle = document.getElementById("dutyToggle");
    const text = document.getElementById("dutyStatusText");

    if(!toggle || !text){
        return;
    }

    if(onDuty){
        toggle.classList.remove("off-duty");
        text.textContent = "On Duty";
    }
    else{
        toggle.classList.add("off-duty");
        text.textContent = "Off Duty";
    }

}

async function loadDutyStatus(){

    const token = localStorage.getItem("plateTrackToken");

    if(!token){
        return;
    }

    try{

        const response = await fetch(
            `${API_BASE}/enforcer/duty-status`,
            {
                method:"GET",
                headers:{
                    "Authorization":`Bearer ${token}`
                }
            }
        );

        if(!response.ok){
            return;
        }

        const data = await response.json();

        renderDutyStatus(Boolean(data.onDuty));

    }
    catch(error){

        console.error("Unable to load duty status:",error);

    }

}

async function toggleDutyStatus(){

    const token = localStorage.getItem("plateTrackToken");

    if(!token){
        window.location.href = "enforcer-login.html";
        return;
    }

    const toggle = document.getElementById("dutyToggle");
    const currentlyOnDuty = toggle && !toggle.classList.contains("off-duty");
    const nextState = !currentlyOnDuty;

    if(toggle){
        toggle.disabled = true;
    }

    try{

        const response = await fetch(
            `${API_BASE}/enforcer/duty-status`,
            {
                method:"PATCH",
                headers:{
                    "Content-Type":"application/json",
                    "Authorization":`Bearer ${token}`
                },
                body: JSON.stringify({ onDuty: nextState })
            }
        );

        if(response.status === 401){
            localStorage.removeItem("plateTrackToken");
            localStorage.removeItem("plateTrackEnforcerSession");
            window.location.href = "enforcer-login.html";
            return;
        }

        if(!response.ok){
            showError(
                "Unable to Update",
                "Could not update your duty status right now. Please try again."
            );
            return;
        }

        const data = await response.json();

        renderDutyStatus(Boolean(data.onDuty));

        showSuccess(
            data.onDuty ? "You're now On Duty" : "You're now Off Duty",
            data.onDuty
                ? "You can now use plate detection and submit violation reports."
                : "Plate detection and violation submission are disabled until you go back on duty."
        );

    }
    catch(error){

        console.error("Unable to update duty status:",error);

        showError(
            "Unable to Update",
            "Could not reach the server. Please check your connection and try again."
        );

    }
    finally{

        if(toggle){
            toggle.disabled = false;
        }

    }

}
