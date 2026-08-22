// ==========================================
// PLATETRACK SETTINGS
// ==========================================

// ==========================================
// PAGE LOAD
// ==========================================

document.addEventListener("DOMContentLoaded",function(){

    loadSettings();

    setupThemeToggle();

});

// ==========================================
// LOAD SETTINGS
// ==========================================

function loadSettings(){

    const darkMode =
    localStorage.getItem("plateTrackDarkMode");

    const notifications =
    localStorage.getItem("plateTrackNotifications");

    const sound =
    localStorage.getItem("plateTrackDetectionSound");

    const themeToggle =
    document.getElementById("themeToggle");

    const notificationToggle =
    document.getElementById("notificationToggle");

    const soundToggle =
    document.getElementById("soundToggle");

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

    soundToggle.checked =
    sound === null ? true : sound === "true";

}

// ==========================================
// THEME TOGGLE
// ==========================================

function setupThemeToggle(){

    const toggle =
    document.getElementById("themeToggle");

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

    const themeToggle =
    document.getElementById("themeToggle");

    const notificationToggle =
    document.getElementById("notificationToggle");

    const soundToggle =
    document.getElementById("soundToggle");

    localStorage.setItem(
        "plateTrackDarkMode",
        themeToggle.checked
    );

    localStorage.setItem(
        "plateTrackNotifications",
        notificationToggle.checked
    );

    localStorage.setItem(
        "plateTrackDetectionSound",
        soundToggle.checked
    );

    showSuccess(
        "Settings Saved",
        "Your PlateTrack preferences have been updated.",
        function(){
            window.location.reload();
        }
    );

}
