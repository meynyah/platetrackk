function protectOwnerDashboard() {

    const token = localStorage.getItem("plateTrackOwnerToken");
    const session = localStorage.getItem("plateTrackOwnerUser");

    if (!token || !session) {
        window.location.replace("owner-login.html");
        return false;
    }

    return true;
}

// ==========================================
// PlateTrack | Owner Dashboard
// Backend + JWT Version
// ==========================================

// API_BASE comes from shared/js/config.js (loaded before this file).

let ownerSessionToken = null;
let ownerNotificationsCache = [];

document.addEventListener("DOMContentLoaded", async () => {
    if (!protectOwnerDashboard()) {
        return;
    }

    const session = requireOwnerSession();

    if(!session){
        return;
    }

    ownerSessionToken = session.token;

    updateDateTime();
    updateGreeting();
    loadOwnerInfo(session.user);
    loadRegisteredPlate(session.user);

    setInterval(updateDateTime, 1000);

    await loadOwnerDashboardData(session.token);
    await loadOwnerNotifications();

});

// ==========================================
// SESSION
// ==========================================

function requireOwnerSession() {

    const token = localStorage.getItem("plateTrackOwnerToken");
    const userRaw = localStorage.getItem("plateTrackOwnerUser");

    if (!token || !userRaw) {
        window.location.replace("owner-login.html");
        return null;
    }

    try {
        return {
            token,
            user: JSON.parse(userRaw)
        };
    } catch (error) {
        localStorage.removeItem("plateTrackOwnerToken");
        localStorage.removeItem("plateTrackOwnerUser");

        window.location.replace("owner-login.html");
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

        window.location.replace("owner-login.html");

        throw new Error(
            data.message ||
            "Your session has expired. Please sign in again."
        );
    }

    if(!response.ok){

        throw new Error(
            data.message ||
            "Unable to load owner data."
        );
    }

    return data;
}

// ==========================================
// DATE / TIME / GREETING
// ==========================================

function updateDateTime(){

    const now = new Date();

    const todayDate =
        document.getElementById("todayDate");

    const liveTime =
        document.getElementById("liveTime");

    if(todayDate){

        todayDate.textContent =
            now.toLocaleDateString(
                "en-PH",
                {
                    year:"numeric",
                    month:"long",
                    day:"numeric"
                }
            );
    }

    if(liveTime){

        liveTime.textContent =
            now.toLocaleTimeString(
                "en-PH",
                {
                    hour:"numeric",
                    minute:"2-digit",
                    second:"2-digit",
                    hour12:true
                }
            );
    }
}

function updateGreeting(){

    const greeting =
        document.getElementById("greeting");

    if(!greeting){
        return;
    }

    const hour = new Date().getHours();

    if(hour < 12){

        greeting.textContent =
            "Good Morning ☀️";

    }else if(hour < 18){

        greeting.textContent =
            "Good Afternoon 🌤";

    }else{

        greeting.textContent =
            "Good Evening 🌙";
    }
}

// ==========================================
// OWNER INFORMATION
// ==========================================

function loadOwnerInfo(owner){

    const ownerName =
        document.getElementById("ownerName");

    const ownerEmail =
        document.getElementById("ownerEmail");

    if(ownerName){

        ownerName.textContent =
            owner.fullName ||
            "Vehicle Owner";
    }

    if(ownerEmail){

        ownerEmail.textContent =
            owner.email ||
            "No email available";
    }

    const image =
        document.getElementById("dashboardAvatarImage");

    const icon =
        document.getElementById("dashboardAvatarIcon");

    if(image){
        image.style.display = "none";
    }

    if(icon){
        icon.style.display = "block";
    }
}

function loadRegisteredPlate(owner){

    const plateList =
        document.getElementById("plateList");

    const plateCount =
        document.getElementById("plateCount");

    const plateNumber =
        String(owner.plateNumber || "")
            .trim()
            .toUpperCase();

    if(plateCount){

        plateCount.textContent =
            plateNumber ? "1" : "0";
        plateCount.classList.remove("is-loading");
    }

    if(!plateList){
        return;
    }

    if(!plateNumber){

        plateList.innerHTML = `
            <div class="plate-chip">
                <i class="fa-solid fa-circle-info"></i>
                No registered plate
            </div>
        `;

        return;
    }

    plateList.innerHTML = `
        <div class="plate-chip">

            <i class="fa-solid fa-id-card"></i>

            ${escapeHtml(plateNumber)}

            <span class="plate-chip-detail">
                Registered Vehicle
            </span>

        </div>
    `;
}

// ==========================================
// LOAD DASHBOARD DATA
// ==========================================

async function loadOwnerDashboardData(token){

    try{

        const [
            violations,
            appeals
        ] = await Promise.all([

            ownerApiRequest(
                "/owner/violations/mine",
                token
            ),

            ownerApiRequest(
                "/owner/appeals/mine",
                token
            )

        ]);

        const safeViolations =
            Array.isArray(violations)
                ? violations
                : [];

        safeViolations.sort(function (a, b) {

            return new Date(
                b.dateTime || b.createdAt
            ) - new Date(
                a.dateTime || a.createdAt
            );

        });

        const safeAppeals =
            Array.isArray(appeals)
                ? appeals
                : [];

        loadStats(
            safeViolations,
            safeAppeals
        );

        loadRecentViolations(
            safeViolations
        );

    }catch(error){

        console.error(
            "Owner dashboard loading error:",
            error
        );

        const recentViolations =
            document.getElementById(
                "recentViolations"
            );

        if(recentViolations){

            recentViolations.innerHTML = `
                <div class="empty-state" style="display:flex;">

                    <div class="empty-icon">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>

                    <h3>
                        Unable to Load Records
                    </h3>

                    <p>
                        ${escapeHtml(
                            error.message ||
                            "Please refresh the dashboard."
                        )}
                    </p>

                </div>
            `;
        }
    }
}

// ==========================================
// STATS
// ==========================================

function loadStats(violations, appeals){

    const violationCount =
        document.getElementById(
            "violationCount"
        );

    const pendingAppeals =
        document.getElementById(
            "pendingAppeals"
        );

    const pending =
        appeals.filter(function(appeal){

            return (
                appeal.status === "submitted" ||
                appeal.status === "under_review"
            );
        });

    if(violationCount){

        violationCount.textContent =
            violations.length;
        violationCount.classList.remove("is-loading");
    }

    if(pendingAppeals){

        pendingAppeals.textContent =
            pending.length;
        pendingAppeals.classList.remove("is-loading");
    }
}

// ==========================================
// RECENT VIOLATIONS
// ==========================================

function loadRecentViolations(violations){

    const container =
        document.getElementById(
            "recentViolations"
        );

    if(!container){
        return;
    }

    container.innerHTML = "";

    if(!violations.length){

        container.innerHTML = `
            <div class="empty-state" style="display:flex;">

                <div class="empty-icon">
                    <i class="fa-solid fa-circle-check"></i>
                </div>

                <h3>
                    No Violations Found
                </h3>

                <p>
                    Your registered plate has no recorded violations.
                </p>

            </div>
        `;

        return;
    }

    violations
        .slice(0, 3)
        .forEach(function(item){

            const date =
                item.dateTime
                    ? new Date(
                        item.dateTime
                    ).toLocaleString(
                        "en-PH",
                        {
                            month:"short",
                            day:"numeric",
                            year:"numeric",
                            hour:"numeric",
                            minute:"2-digit"
                        }
                    )
                    : "Recent";

            container.insertAdjacentHTML(
                "beforeend",
                `
                    <div class="detection-card">

                        <div class="plate-icon">

                            <i class="fa-solid fa-car"></i>

                        </div>

                        <div class="plate-details">

                            <h3>
                                ${escapeHtml(
                                    item.plateNumber ||
                                    "Unknown Plate"
                                )}
                            </h3>

                            <p>
                                ${escapeHtml(item.vehicleType || "Unknown Vehicle")} &bull; ${escapeHtml(item.vehicleColor || "Unknown Color")}
                            </p>

                            <small>
                                ${escapeHtml(
                                    item.violationType ||
                                    "Traffic Violation"
                                )}
                            </small>

                            <small>
                                ${escapeHtml(
                                    item.location ||
                                    "Antipolo City"
                                )}
                            </small>

                        </div>

                        <span class="time-badge">
                            ${escapeHtml(date)}
                        </span>

                    </div>
                `
            );
        });
}

// ==========================================
// NOTIFICATIONS
// ==========================================

async function loadOwnerNotifications(){

    if(!ownerSessionToken){
        return;
    }

    try{

        const notifications = await ownerApiRequest(
            "/owner/notifications",
            ownerSessionToken
        );

        ownerNotificationsCache =
            Array.isArray(notifications)
                ? notifications
                : [];

    }catch(error){

        console.error(
            "Failed to load notifications:",
            error
        );

        ownerNotificationsCache = [];

    }

    renderNotificationBadge();
    renderNotificationList();

}

function renderNotificationBadge(){

    const badge =
        document.getElementById("notificationCount");

    if(!badge){
        return;
    }

    const unreadCount =
        ownerNotificationsCache.filter(function(item){
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

    return date.toLocaleString(
        "en-PH",
        {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );

}

function renderNotificationList(){

    const list =
        document.getElementById("notificationList");

    if(!list){
        return;
    }

    if(ownerNotificationsCache.length === 0){

        list.innerHTML = `
            <div class="notification-item simple">
                <i class="fa-solid fa-circle-info"></i>
                <span>No new notifications.</span>
            </div>
        `;

        return;
    }

    list.innerHTML =
        ownerNotificationsCache
            .map(function(item){

                return `
                    <div
                    class="notification-item${item.read ? "" : " unread"}"
                    onclick="markOwnerNotificationRead('${item._id}')">

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

            })
            .join("");

}

async function markOwnerNotificationRead(id){

    const target =
        ownerNotificationsCache.find(function(item){
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

    try{

        await ownerApiRequest(
            `/owner/notifications/${id}/read`,
            ownerSessionToken,
            { method: "PATCH" }
        );

    }catch(error){

        console.error(
            "Failed to mark notification as read:",
            error
        );

    }

}

function openNotificationModal(){

    const modal =
        document.getElementById("notificationModal");

    if(!modal){
        return;
    }

    modal.classList.add("show");

    // Refresh in case something new arrived since the dashboard loaded.
    loadOwnerNotifications();

}

function closeNotificationModal(){

    const modal =
        document.getElementById("notificationModal");

    if(modal){
        modal.classList.remove("show");
    }

}

window.openNotificationModal = openNotificationModal;
window.closeNotificationModal = closeNotificationModal;
window.markOwnerNotificationRead = markOwnerNotificationRead;

// ==========================================
// MENU
// ==========================================

function toggleMenu(){

    const menu =
        document.getElementById("headerMenu");

    if(!menu){
        return;
    }

    menu.style.display =
        menu.style.display === "block"
            ? "none"
            : "block";
}

window.toggleMenu = toggleMenu;

window.addEventListener("click", function(event){

    if(!event.target.closest(".menu-wrapper")){

        const menu =
            document.getElementById(
                "headerMenu"
            );

        if(menu){
            menu.style.display = "none";
        }
    }
});

// ==========================================
// LOGOUT
// ==========================================

function confirmLogout() {

    showConfirm(
        "Logout",
        "Are you sure you want to logout?",
        function() {

            localStorage.removeItem("plateTrackOwnerToken");
            localStorage.removeItem("plateTrackOwnerUser");

            window.location.replace("owner-login.html");
        }
    );
}

window.confirmLogout = confirmLogout;

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

window.addEventListener("pageshow", function () {

    const token = localStorage.getItem("plateTrackOwnerToken");
    const owner = localStorage.getItem("plateTrackOwnerUser");

    if (!token || !owner) {
        window.location.replace("owner-login.html");
    }

});