// ==========================================
// PLATETRACK CAMERA
// ==========================================

let stream = null;
let scanning = false;
let currentFacingMode = "environment";
let detectionTimer = null;

// ==========================================
// CAMERA HELPERS
// ==========================================

function getElement(id){

    return document.getElementById(id);

}

function setText(id,text){

    const element = getElement(id);

    if(element){
        element.textContent = text;
    }

}

function showElement(id,displayType = "flex"){

    const element = getElement(id);

    if(element){
        element.style.display = displayType;
    }

}

function hideElement(id){

    const element = getElement(id);

    if(element){
        element.style.display = "none";
    }

}

// ==========================================
// OPEN CAMERA
// ==========================================

async function openCamera(){

    try{

        closeCamera();

        stream = await navigator.mediaDevices.getUserMedia({

            video:{
                facingMode:currentFacingMode
            },

            audio:false

        });

        const video = getElement("camera");

        video.srcObject = stream;
        video.style.display = "block";

        hideElement("cameraPlaceholder");

        document.querySelector(".detection-frame").style.display = "block";

        setText("cameraStatus","Active");

        return true;

    }
    catch(error){

        showError(
            "Camera Error",
            "Unable to access the device camera. Please allow camera permission."
        );

        setText("cameraStatus","Blocked");
        setText("aiStatus","Waiting");

        return false;

    }

}

// ==========================================
// CLOSE CAMERA
// ==========================================

function closeCamera(){

    if(stream){

        stream.getTracks().forEach(function(track){
            track.stop();
        });

        stream = null;

    }

}

// ==========================================
// START DETECTION
// ==========================================

async function startDetection(){

    if(scanning){
        return;
    }

    scanning = true;

    const cameraOpened = await openCamera();

    if(!cameraOpened){
        scanning = false;
        return;
    }

    setText("scanStatus","Camera Active");
    getElement("scanStatus").className = "status-value scanning";

    setText("aiStatus","Ready");
    setText("plateNumber","--------");
    setText("vehicleType","Not Detected");
    setText("vehicleColor","Not Detected");
    setText("detectionTime","--:--:--");

    hideElement("startDetectionBtn");

    showElement("captureBtn");
    showElement("switchCameraBtn");
    showElement("stopDetectionBtn");

    document.querySelector(".detection-frame").style.display = "block";
    hideElement("scanLine");

}

// ==========================================
// CAPTURE PLATE
// ==========================================

function capturePlate(){

    if(!scanning){
        return;
    }

    showElement("processingOverlay");

    showElement("scanLine","block");

    setText("scanStatus","Scanning Plate...");
    getElement("scanStatus").className = "status-value scanning";

    setText("aiStatus","Processing");

    captureFrame(function(imageBlob){
        detectPlateFromImage(imageBlob);
    });

}

// ==========================================
// CAPTURE CURRENT FRAME
// ==========================================

function captureFrame(onReady){

    const video = getElement("camera");
    const canvas = getElement("captureCanvas");

    if(!video || !canvas){
        if(onReady) onReady(null);
        return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext("2d");

    context.drawImage(video,0,0,canvas.width,canvas.height);

    try{

        const imageData = canvas.toDataURL("image/jpeg",0.85);

        localStorage.setItem("plateTrackCapturedImage",imageData);

    }
    catch(error){

        console.warn("Unable to save captured frame.");

    }

    if(onReady){

        canvas.toBlob(function(blob){
            onReady(blob);
        },"image/jpeg",0.85);

    }

}

// ==========================================
// REAL AI DETECTION (via backend -> Python ML service)
// ==========================================

async function detectPlateFromImage(imageBlob){

    if(!scanning){
        return;
    }

    if(!imageBlob){
        handleDetectionFailure("Unable to capture the video frame. Please try again.");
        return;
    }

    const token = localStorage.getItem("plateTrackToken");

    if(!token){
        window.location.href = "enforcer-login.html";
        return;
    }

    try{

        const formData = new FormData();
        formData.append("image", imageBlob, "capture.jpg");

        const response = await fetch(
            `${API_BASE}/enforcer/detect-plate`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            }
        );

        if(response.status === 401 || response.status === 403){
            localStorage.removeItem("plateTrackToken");
            localStorage.removeItem("plateTrackEnforcerSession");
            window.location.href = "enforcer-login.html";
            return;
        }

        const data = await response.json().catch(function(){ return {}; });

        if(!response.ok || !data.success){
            handleDetectionFailure(
                data.message || "No license plate was detected. You can still fill in the details manually."
            );
            return;
        }

        handleDetectionSuccess(data);

    }
    catch(error){

        console.error("Plate detection request failed:", error);

        handleDetectionFailure(
            "Unable to reach the detection service. You can still fill in the details manually."
        );

    }

}

function handleDetectionSuccess(data){

    const detectionTime = new Date().toLocaleString("en-US",{
        month:"long",
        day:"numeric",
        year:"numeric",
        hour:"numeric",
        minute:"2-digit",
        hour12:true
    });

    const owner = data.owner && data.owner.found ? data.owner : null;

    setText("plateNumber",data.plateNumber);
    // If a registered owner matched this plate, auto-fill their vehicle's
    // type/color. Otherwise, the ML model has no way to know these -- they
    // stay blank for the enforcer to fill in on the next screen.
    setText("vehicleType", owner && owner.vehicleType ? owner.vehicleType : "Not detected");
    setText("vehicleColor", owner && owner.vehicleColor ? owner.vehicleColor : "Not detected");
    setText("detectionTime",detectionTime);

    setText("scanStatus","Plate Detected");
    getElement("scanStatus").className = "status-value detected";

    setText("aiStatus","Completed");

    hideElement("processingOverlay");
    hideElement("scanLine");

    localStorage.setItem(
        "plateTrackDetectionResult",
        JSON.stringify({
            plateNumber: data.plateNumber,
            vehicleType: owner ? owner.vehicleType || "" : "",
            vehicleColor: owner ? owner.vehicleColor || "" : "",
            detectionTime: detectionTime,
            detectionConfidence: data.detectionConfidence,
            ocrConfidence: data.ocrConfidence,
            ownerFound: Boolean(owner),
            ownerName: owner ? owner.fullName : "",
            ownerEmail: owner ? owner.email : "",
            source: "camera-ai"
        })
    );

    showSuccess(
        "Detection Successful",
        owner
            ? `License plate detected: ${data.plateNumber}. Registered owner found: ${owner.fullName}.`
            : `License plate detected: ${data.plateNumber}. No registered owner found -- please confirm the vehicle details on the next screen.`
    );

    setTimeout(function(){
        window.location.href = "detection-result.html";
    },1500);

}

function handleDetectionFailure(message){

    hideElement("processingOverlay");
    hideElement("scanLine");

    setText("scanStatus","Detection Failed");
    getElement("scanStatus").className = "status-value";

    setText("aiStatus","Failed");

    showError("No Plate Detected", message);

}

// ==========================================
// SWITCH CAMERA
// ==========================================

async function switchCamera(){

    if(!scanning){
        return;
    }

    currentFacingMode =
    currentFacingMode === "environment" ? "user" : "environment";

    setText("cameraStatus","Switching...");

    await openCamera();

    setText("cameraStatus","Active");

}

// ==========================================
// STOP DETECTION
// ==========================================

function stopDetection(){

    scanning = false;

    if(detectionTimer){
        clearTimeout(detectionTimer);
        detectionTimer = null;
    }

    closeCamera();

    hideElement("processingOverlay");

    setText("scanStatus","Ready to Scan");
    getElement("scanStatus").className = "status-value ready";

    setText("cameraStatus","Ready");
    setText("aiStatus","Waiting");

    setText("plateNumber","--------");
    setText("vehicleType","Not Detected");
    setText("vehicleColor","Not Detected");
    setText("detectionTime","--:--:--");

    hideElement("captureBtn");
    hideElement("switchCameraBtn");
    hideElement("stopDetectionBtn");

    showElement("startDetectionBtn");

    hideElement("camera");
    showElement("cameraPlaceholder");

    document.querySelector(".detection-frame").style.display = "none";

    hideElement("scanLine")

}

// ==========================================
// FLASH BUTTON
// ==========================================

document.addEventListener("DOMContentLoaded",function(){

    const flashBtn = getElement("flashBtn");

    if(flashBtn){

        flashBtn.addEventListener("click",function(){

            showSuccess(
                "Flash",
                "Flash control will be available in the Android version."
            );

        });

    }

});

// ==========================================
// CLEANUP
// ==========================================

window.addEventListener("beforeunload",function(){

    closeCamera();

});
