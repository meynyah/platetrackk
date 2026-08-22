// ==========================================
// PlateTrack | Owner Settings
// ==========================================

document.addEventListener("DOMContentLoaded",function(){

    requireOwnerSession();

    loadSettings();

    setupThemeToggle();

});

function requireOwnerSession(){

    const sessionEmail = localStorage.getItem("plateTrackOwnerSession");

    if(!sessionEmail){
        window.location.href = "owner-login.html";
    }

}

// ==========================================
// LOAD SETTINGS
// ==========================================

function loadSettings(){

    const darkMode = localStorage.getItem("plateTrackDarkMode");
    const notifications = localStorage.getItem("plateTrackOwnerNotifications");
    const appealUpdates = localStorage.getItem("plateTrackOwnerAppealUpdates");

    const themeToggle = document.getElementById("themeToggle");
    const notificationToggle = document.getElementById("notificationToggle");
    const appealUpdatesToggle = document.getElementById("appealUpdatesToggle");

    // Default: Dark Mode ON

    if(darkMode === null){

        themeToggle.checked = true;
        document.body.classList.remove("light-mode");

    }
    else{

        themeToggle.checked = darkMode === "true";

        if(themeToggle.checked){
            document.body.classList.remove("light-mode");
        }
        else{
            document.body.classList.add("light-mode");
        }

    }

    notificationToggle.checked =
    notifications === null ? true : notifications === "true";

    appealUpdatesToggle.checked =
    appealUpdates === null ? true : appealUpdates === "true";

}

// ==========================================
// THEME TOGGLE
// ==========================================

function setupThemeToggle(){

    const toggle = document.getElementById("themeToggle");

    toggle.addEventListener("change",function(){

        if(this.checked){
            document.body.classList.remove("light-mode");
        }
        else{
            document.body.classList.add("light-mode");
        }

    });

}

// ==========================================
// SAVE SETTINGS
// ==========================================

function saveSettings(){

    const themeToggle = document.getElementById("themeToggle");
    const notificationToggle = document.getElementById("notificationToggle");
    const appealUpdatesToggle = document.getElementById("appealUpdatesToggle");

    localStorage.setItem("plateTrackDarkMode", themeToggle.checked);
    localStorage.setItem("plateTrackOwnerNotifications", notificationToggle.checked);
    localStorage.setItem("plateTrackOwnerAppealUpdates", appealUpdatesToggle.checked);

    showSuccess(
        "Settings Saved",
        "Your PlateTrack preferences have been updated."
    );

    window.location.reload();

}
