// ==========================================
// PLATETRACK
// UNIFIED VIOLATION FORM
// ==========================================
// API_BASE comes from shared/js/config.js (loaded before this file).

let isCameraMode = false;

// ==========================================
// ENFORCER AUTH TOKEN
// (login stores it in localStorage if "remember me"
// was checked, otherwise in sessionStorage)
// ==========================================

function getEnforcerToken(){

    return (
        localStorage.getItem("plateTrackToken") ||
        sessionStorage.getItem("plateTrackToken")
    );

}

// ==========================================
// EVIDENCE CAPTURE STATE
// ==========================================

let evidenceStream = null;
let capturedEvidenceImage = null;

// ==========================================
// PAGE LOAD
// ==========================================

document.addEventListener("DOMContentLoaded",function(){

    loadOfficerInfo();

    initializeForm();

    setupViolationDropdown();

    updateDateTime();

    setInterval(updateDateTime,1000);

});

// ==========================================
// OFFICER INFO
// (populates the read-only "Officer" / "Badge No." fields with the
// actual logged-in enforcer, instead of the placeholder values that used
// to be hardcoded directly in the HTML)
// ==========================================

function loadOfficerInfo(){

    const raw =
        localStorage.getItem("plateTrackEnforcerSession") ||
        sessionStorage.getItem("plateTrackEnforcerSession");

    if(!raw){
        return;
    }

    try{

        const enforcer = JSON.parse(raw);

        const officerField = document.getElementById("officerName");
        const badgeField = document.getElementById("badgeNumber");

        if(officerField){
            officerField.value = enforcer.fullName || "Not available";
        }

        if(badgeField){
            badgeField.value = enforcer.badgeNumber || "Not available";
        }

    }catch(error){

        console.error("Unable to read enforcer session:", error);

    }

}

// ==========================================
// INITIALIZE FORM
// ==========================================

function initializeForm(){

    const detectionData = JSON.parse(

        localStorage.getItem("plateTrackDetectionResult")

    );

    if(detectionData){

        isCameraMode = true;

        document.getElementById("formTitle").textContent =
        "Violation Form";

        document.getElementById("formSubtitle").textContent =
        "Review the detected vehicle and record the violation.";

        document.getElementById("formModeText").textContent =
        "Vehicle information was detected automatically.";

        document.getElementById("plateNumber").value =
        detectionData.plateNumber || "";

        document.getElementById("vehicleType").value =
        detectionData.vehicleType || "";

        document.getElementById("vehicleColor").value =
        detectionData.vehicleColor || "";

        document.getElementById("plateNumber").readOnly = true;
        document.getElementById("vehicleType").readOnly = true;
        document.getElementById("vehicleColor").readOnly = true;

    }

    else{

        isCameraMode = false;

        document.getElementById("formTitle").textContent =
        "Manual Violation";

        document.getElementById("formSubtitle").textContent =
        "Record a traffic violation manually.";

        document.getElementById("formModeText").textContent =
        "Fill in the vehicle information below.";

    }

}

// ==========================================
// EVIDENCE CAPTURE (OPTIONAL PHOTO)
// ==========================================

async function openEvidenceCamera(){

    try{

        evidenceStream = await navigator.mediaDevices.getUserMedia({
            video:{ facingMode:"environment" },
            audio:false
        });

        const video = document.getElementById("evidenceVideo");

        video.srcObject = evidenceStream;
        video.style.display = "block";

        document.getElementById("evidencePlaceholder").style.display = "none";
        document.getElementById("evidencePhoto").style.display = "none";

        document.getElementById("openCameraBtn").style.display = "none";
        document.getElementById("captureEvidenceBtn").style.display = "inline-flex";
        document.getElementById("retakeEvidenceBtn").style.display = "none";

    }
    catch(error){

        showError(
            "Camera Error",
            "Unable to access the device camera. Please check your camera permission."
        );

    }

}

function captureEvidencePhoto(){

    const video = document.getElementById("evidenceVideo");
    const canvas = document.getElementById("evidenceCanvas");

    if(!video || !canvas){
        return;
    }

    // Cap the resolution to keep the resulting image small,
    // since this app stores everything as base64 text in
    // the browser's localStorage (which has a limited quota).
    const maxWidth = 640;
    const sourceWidth = video.videoWidth || maxWidth;
    const sourceHeight = video.videoHeight || 480;
    const scale = Math.min(1, maxWidth / sourceWidth);

    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try{

        capturedEvidenceImage = canvas.toDataURL("image/jpeg", 0.7);

    }
    catch(error){

        console.error("Unable to capture evidence photo:", error);

        showError(
            "Capture Failed",
            "Unable to capture the photo. Please try again."
        );

        return;

    }

    stopEvidenceCamera();

    const photo = document.getElementById("evidencePhoto");

    photo.src = capturedEvidenceImage;
    photo.style.display = "block";

    document.getElementById("captureEvidenceBtn").style.display = "none";
    document.getElementById("retakeEvidenceBtn").style.display = "inline-flex";

}

function stopEvidenceCamera(){

    if(evidenceStream){

        evidenceStream.getTracks().forEach(function(track){
            track.stop();
        });

        evidenceStream = null;

    }

    const video = document.getElementById("evidenceVideo");

    if(video){
        video.style.display = "none";
    }

}

function retakeEvidencePhoto(){

    capturedEvidenceImage = null;

    document.getElementById("evidencePhoto").style.display = "none";
    document.getElementById("evidencePlaceholder").style.display = "flex";

    document.getElementById("retakeEvidenceBtn").style.display = "none";
    document.getElementById("openCameraBtn").style.display = "inline-flex";

}

window.addEventListener("beforeunload", stopEvidenceCamera);

// ==========================================
// AUTO DATE & TIME
// ==========================================

function updateDateTime(){

    document.getElementById("recordDateTime").value =

    new Intl.DateTimeFormat("en-US",{

        month:"long",

        day:"numeric",

        year:"numeric",

        hour:"numeric",

        minute:"2-digit",

        second:"2-digit",

        hour12:true

    }).format(new Date());

}

// ==========================================
// VIOLATION DROPDOWN
// ==========================================

function setupViolationDropdown(){

    const violationType =
    document.getElementById("violationType");

    const otherGroup =
    document.getElementById("otherViolationGroup");

    const otherInput =
    document.getElementById("otherViolation");

    violationType.addEventListener("change",function(){

        if(this.value === "Others"){

            otherGroup.style.display = "flex";
            otherInput.focus();

        }
        else{

            otherGroup.style.display = "none";
            otherInput.value = "";

        }

    });

}

// ==========================================
// GO BACK
// ==========================================

function goBack(){

    stopEvidenceCamera();

    if(isCameraMode){
        window.location.href = "detection-result.html";
    }
    else{
        window.location.href = "enforcer-dashboard.html";
    }

}

// ==========================================
// VALIDATION HELPER
// ==========================================

function getCleanValue(id){

    return document.getElementById(id).value.trim();

}

function validateForm(){

    if(getCleanValue("plateNumber") === ""){

        showError(
            "Missing Plate Number",
            "Please enter the vehicle plate number."
        );

        return false;

    }

    if(getCleanValue("vehicleType") === ""){

        showError(
            "Missing Vehicle Type",
            "Please enter the vehicle type or model."
        );

        return false;

    }

    if(getCleanValue("vehicleColor") === ""){

        showError(
            "Missing Vehicle Color",
            "Please enter the vehicle color."
        );

        return false;

    }

    if(getCleanValue("violationType") === ""){

        showError(
            "Missing Violation",
            "Please select a traffic violation."
        );

        return false;

    }

    if(getCleanValue("violationType") === "Others" &&
       getCleanValue("otherViolation") === ""){

        showError(
            "Specify Violation",
            "Please specify the traffic violation."
        );

        return false;

    }

    return true;

}

// ==========================================
// SAVE VIOLATION
// ==========================================

async function goToReview(){

    if(!validateForm()){
        return;
    }

    let violation = getCleanValue("violationType");

    if(violation === "Others"){
        violation = getCleanValue("otherViolation");
    }

    const plateNumber = getCleanValue("plateNumber").toUpperCase();

    setText("reviewPlateNumber", plateNumber);
    setText("reviewVehicleType", getCleanValue("vehicleType"));
    setText("reviewVehicleColor", getCleanValue("vehicleColor"));
    setText("reviewViolationType", violation);
    setText("reviewLocation", getCleanValue("location"));
    setText("reviewOfficerNotes", getCleanValue("officerNotes") || "No additional remarks.");
    setText("reviewOfficerName", getCleanValue("officerName"));
    setText("reviewBadgeNumber", getCleanValue("badgeNumber"));
    setText("reviewDateTime", getCleanValue("recordDateTime"));

    const reviewPhotoWrapper = document.getElementById("reviewEvidencePreview");
    const reviewPhoto = document.getElementById("reviewEvidencePhoto");

    if(capturedEvidenceImage && reviewPhoto && reviewPhotoWrapper){
        reviewPhoto.src = capturedEvidenceImage;
        reviewPhotoWrapper.style.display = "block";
    }
    else if(reviewPhotoWrapper){
        reviewPhotoWrapper.style.display = "none";
    }

    document.getElementById("formStep").style.display = "none";
    document.getElementById("reviewStep").style.display = "block";

    window.scrollTo({ top:0, behavior:"smooth" });

    // Look up whether this plate matches a registered owner -- useful
    // especially when the plate was typed in manually because the actual
    // plate was dirty or partially obstructed, so the enforcer can still
    // see (and cross-check) who the vehicle is registered to.
    await lookupAndShowOwner(plateNumber);

}

async function lookupAndShowOwner(plateNumber){

    const ownerSection = document.getElementById("reviewOwnerSection");
    const notFoundSection = document.getElementById("reviewOwnerNotFound");

    if(!ownerSection || !notFoundSection){
        return;
    }

    ownerSection.style.display = "none";
    notFoundSection.style.display = "none";

    const token = getEnforcerToken();

    if(!token || !plateNumber){
        return;
    }

    try{

        const response = await fetch(
            `${API_BASE}/enforcer/lookup-owner?plateNumber=${encodeURIComponent(plateNumber)}`,
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

        if(data.owner && data.owner.found){

            setText("reviewOwnerName", data.owner.fullName);
            setText("reviewOwnerEmail", data.owner.email);
            setText("reviewOwnerAddress", data.owner.address);
            setText("reviewOwnerVehicleType", data.owner.vehicleType);
            setText("reviewOwnerVehicleColor", data.owner.vehicleColor);

            ownerSection.style.display = "block";

        }
        else{

            notFoundSection.style.display = "block";

        }

    }
    catch(error){

        console.error("Owner lookup failed:", error);
        // Silent failure -- this is a helpful cross-check, not a required
        // step, so a network hiccup here shouldn't block the enforcer
        // from reviewing and saving the report itself.

    }

}

function setText(id, value){
    const el = document.getElementById(id);
    if(el){
        el.textContent = (value === "" || value === null || value === undefined) ? "--" : value;
    }
}

function backToEdit(){

    document.getElementById("reviewStep").style.display = "none";
    document.getElementById("formStep").style.display = "block";

    window.scrollTo({ top:0, behavior:"smooth" });

}

async function saveViolation(){

    const token = getEnforcerToken();

    if(!token){

        showError(
            "Session Expired",
            "Please log in again before submitting a violation report."
        );

        setTimeout(function(){
            window.location.href = "enforcer-login.html";
        },1500);

        return;

    }

    let violation = getCleanValue("violationType");

    if(violation === "Others"){
        violation = getCleanValue("otherViolation");
    }

    const saveButton = document.getElementById("finalSaveBtn");
    const originalButtonHtml = saveButton ? saveButton.innerHTML : "";

    if(saveButton){

        saveButton.disabled = true;

        saveButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Submitting...
        `;

    }

    const backendPayload = {

    plateNumber:
        getCleanValue("plateNumber").toUpperCase(),

    vehicleType:
        getCleanValue("vehicleType"),

    vehicleColor:
        getCleanValue("vehicleColor"),

    violationType:
        violation,

    location:
        getCleanValue("location"),

    dateTime:
        new Date().toISOString(),

    photoUrl:
        capturedEvidenceImage || null,

    notes:
        getCleanValue("officerNotes")

};

    let submittedViolation;

    try{

        const response = await fetch(
            API_BASE + "/enforcer/violations",
            {
                method:"POST",

                headers:{
                    "Content-Type":"application/json",
                    "Authorization":`Bearer ${token}`
                },

                body:JSON.stringify(backendPayload)
            }
        );

        const data = await response.json();

        if(response.status === 401){

            localStorage.removeItem("plateTrackToken");
            localStorage.removeItem("plateTrackEnforcerSession");
            sessionStorage.removeItem("plateTrackToken");
            sessionStorage.removeItem("plateTrackEnforcerSession");

            showError(
                "Session Expired",
                "Please log in again before submitting a violation report."
            );

            setTimeout(function(){
                window.location.href = "enforcer-login.html";
            },1500);

            return;

        }

        if(response.status === 403){

            showError(
                "Not On Duty",
                data.message || "You must be on duty to submit a violation report."
            );

            return;

        }

        if(!response.ok){

            throw new Error(
                data.message || "Failed to submit the violation report."
            );

        }

        submittedViolation = data.violation;

    }
    catch(error){

        console.error("Unable to submit violation report:", error);

        if(saveButton){

            saveButton.disabled = false;
            saveButton.innerHTML = originalButtonHtml;

        }

        showError(
            "Submission Failed",
            error.message ||
            "Unable to reach the PlateTrack server. Please check your connection and try again."
        );

        return;

    }

    // Local copy, used by this device's recent-detections / history views.
    let history =
    JSON.parse(localStorage.getItem("plateTrackHistory")) || [];

    const year = new Date().getFullYear();

    const recordId =
    (submittedViolation && submittedViolation._id) ||
    `PT-${year}-${String(history.length + 1).padStart(6,"0")}`;

    const violationData = {

        recordId:recordId,

        plateNumber:getCleanValue("plateNumber").toUpperCase(),

        vehicleType:getCleanValue("vehicleType"),

        vehicleColor:getCleanValue("vehicleColor"),

        violation:violation,

        notes:getCleanValue("officerNotes"),

        location:getCleanValue("location"),

        officerName:getCleanValue("officerName"),

        badgeNumber:getCleanValue("badgeNumber"),

        date:getCleanValue("recordDateTime"),

        capturedImage: capturedEvidenceImage || "",

        source:isCameraMode ? "Camera Detection" : "Manual Entry"

    };

    try{

        history.unshift(violationData);

        localStorage.setItem(
            "plateTrackHistory",
            JSON.stringify(history)
        );

    }
    catch(error){

        // Storage quota exceeded is a real risk once photos are attached.
        // Retry once without the photo so the violation record itself isn't lost.
        // The report has already been submitted to the server successfully at
        // this point, so this only affects the local recent-detections view.

        console.error("Unable to save local copy with photo, retrying without it:", error);

        violationData.capturedImage = "";

        history[0] = violationData;

        try{

            localStorage.setItem(
                "plateTrackHistory",
                JSON.stringify(history)
            );

        }
        catch(retryError){

            console.error("Unable to save local copy of violation:", retryError);

        }

    }

    stopEvidenceCamera();

    localStorage.removeItem("plateTrackDetectionResult");
    localStorage.removeItem("plateTrackCapturedImage");

    showSuccess(
        "Violation Saved",
        "The violation record has been submitted successfully."
    );

    setTimeout(function(){
        window.location.href = "history.html";
    },1500);

}
