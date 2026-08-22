// ==========================================
// PLATETRACK DETECTION RESULT
// ==========================================
// API_BASE comes from shared/js/config.js (loaded before this file).

document.addEventListener("DOMContentLoaded",function(){

    loadDetectionData();
    loadCapturedImage();
    loadCurrentLocation();
    setupViolationDropdown();

});

function loadDetectionData(){

    const storedResult = JSON.parse(localStorage.getItem("plateTrackDetectionResult"));

    if(!storedResult){
        showError("No Detection Found","Please scan a license plate first.");

        setTimeout(function(){
            window.location.href = "camera.html";
        },1500);

        return;
    }

    document.getElementById("plateNumber").value =
    storedResult.plateNumber || "";

    document.getElementById("vehicleType").value =
    storedResult.vehicleType || "";

    document.getElementById("vehicleColor").value =
    storedResult.vehicleColor || "";

    document.getElementById("detectionTime").textContent =
    storedResult.detectionTime || getFormattedDateTime();

    const ownerSection = document.getElementById("ownerSection");

    if(storedResult.ownerFound && ownerSection){

        document.getElementById("ownerName").textContent =
        storedResult.ownerName || "--";

        document.getElementById("ownerEmail").textContent =
        storedResult.ownerEmail || "--";

        ownerSection.style.display = "block";

    }
    else if(ownerSection){

        ownerSection.style.display = "none";

    }

}

function loadCapturedImage(){

    const capturedImage = localStorage.getItem("plateTrackCapturedImage");
    const captureBox = document.querySelector(".capture-image");

    if(!captureBox || !capturedImage){
        return;
    }

    captureBox.innerHTML = `
        <img src="${capturedImage}" alt="Captured vehicle image" class="captured-photo">
    `;

}

function getFormattedDateTime(){

    return new Intl.DateTimeFormat("en-US",{
        month:"long",
        day:"numeric",
        year:"numeric",
        hour:"numeric",
        minute:"2-digit",
        hour12:true
    }).format(new Date());

}

function loadCurrentLocation(){

    const locationElement = document.getElementById("currentLocation");

    if(!navigator.geolocation){
        locationElement.textContent = "Antipolo City";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(){
            locationElement.textContent = "Antipolo City";
        },
        function(){
            locationElement.textContent = "Antipolo City";
        }
    );

}

function setupViolationDropdown(){

    const violation = document.getElementById("violationType");
    const otherGroup = document.getElementById("otherViolationGroup");
    const otherInput = document.getElementById("otherViolation");

    if(!violation || !otherGroup || !otherInput){
        return;
    }

    violation.addEventListener("change",function(){

        if(this.value === "Others"){
            otherGroup.style.display = "flex";
        }
        else{
            otherGroup.style.display = "none";
            otherInput.value = "";
        }

    });

}

async function saveViolation() {

    const saveButton =
        document.querySelector(
            "button[onclick='saveViolation()']"
        );

    const token =
        localStorage.getItem("plateTrackToken");

    if (!token) {

        showError(
            "Session Expired",
            "Please sign in again before submitting a violation."
        );

        setTimeout(function () {
            window.location.replace("enforcer-login.html");
        }, 1500);

        return;
    }

    let violation =
        document.getElementById("violationType").value;

    const otherInput =
        document.getElementById("otherViolation");

    if (!violation) {

        showError(
            "Incomplete Information",
            "Please select a traffic violation."
        );

        return;
    }

    if (violation === "Others") {

        if (
            !otherInput ||
            otherInput.value.trim() === ""
        ) {

            showError(
                "Specify Violation",
                "Please specify the traffic violation."
            );

            return;
        }

        violation = otherInput.value.trim();
    }

    const plateNumber =
        document
            .getElementById("plateNumber")
            .value
            .trim()
            .toUpperCase();

    const notes =
        document
            .getElementById("officerNotes")
            .value
            .trim();

    const location =
        document
            .getElementById("currentLocation")
            .textContent
            .trim();

    if (
        !plateNumber ||
        plateNumber === "UNKNOWN PLATE"
    ) {

        showError(
            "Invalid Plate Number",
            "A valid plate number is required."
        );

        return;
    }

    const capturedImage =
        localStorage.getItem("plateTrackCapturedImage") || null;

    const violationData = {
        plateNumber: plateNumber,

        vehicleType:
            document
                .getElementById("vehicleType")
                .value
                .trim(),

        vehicleColor:
            document
                .getElementById("vehicleColor")
                .value
                .trim(),

        violationType: violation,

        location: location || "Antipolo City",

        notes: notes,

        dateTime: new Date().toISOString(),

        photoUrl: capturedImage
    };

    try {

        if (saveButton) {

            saveButton.disabled = true;

            saveButton.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Saving Violation...
            `;
        }

        const response = await fetch(
            `${API_BASE}/enforcer/violations`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify(violationData)
            }
        );

        let result = null;

        try {
            result = await response.json();
        }
        catch (error) {
            result = null;
        }

        if (response.status === 401) {

            localStorage.removeItem("plateTrackToken");
            localStorage.removeItem(
                "plateTrackEnforcerSession"
            );

            showError(
                "Session Expired",
                "Please sign in again."
            );

            setTimeout(function () {
                window.location.replace(
                    "enforcer-login.html"
                );
            }, 1500);

            return;
        }

        if (!response.ok) {

            throw new Error(
                result?.message ||
                "Failed to submit violation."
            );
        }

        localStorage.removeItem(
            "plateTrackDetectionResult"
        );

        localStorage.removeItem(
            "plateTrackCapturedImage"
        );

        showSuccess(
            "Violation Recorded",
            "The traffic violation was saved to the PlateTrack database."
        );

        setTimeout(function () {
            window.location.replace("history.html");
        }, 1500);

    }
    catch (error) {

        console.error(
            "Violation submission error:",
            error
        );

        showError(
            "Submission Failed",
            error.message ||
            "Unable to save the violation. Please try again."
        );

    }
    finally {

        if (
            saveButton &&
            document.body.contains(saveButton)
        ) {

            saveButton.disabled = false;

            saveButton.innerHTML = `
                <i class="fa-solid fa-floppy-disk"></i>
                Save Violation
            `;
        }
    }
}

function clearNotes(){

    document.getElementById("officerNotes").value = "";

}