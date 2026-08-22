// ==========================================
// PLATETRACK GLOBAL THEME
// ==========================================

(function(){

    const darkMode = localStorage.getItem("plateTrackDarkMode");

    if(darkMode === "false"){
        document.body.classList.add("light-mode");
    }
    else{
        document.body.classList.remove("light-mode");
    }

})();