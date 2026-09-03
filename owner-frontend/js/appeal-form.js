// ==========================================
// PlateTrack | Appeal Form
// ==========================================

// API_BASE comes from shared/js/config.js (loaded before this file).

let currentOwnerToken = null;
let currentRecord = null;

document.addEventListener("DOMContentLoaded", async function(){

    const session = requireOwnerSession();

    if(!session){
        return;
    }

    currentOwnerToken = session.token;

    await loadRecordForAppeal(session.token);
    setupReasonDropdown();

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
        throw new Error(data.message || "Request failed.");
    }

    return data;

}

// ==========================================
// LOAD VIOLATION RECORD (from backend)
// ==========================================

async function loadRecordForAppeal(token){

    const violationId = localStorage.getItem("plateTrackCurrentAppealViolationId");

    if(!violationId){

        showError(
            "No Violation Selected",
            "Please select a violation to appeal from your violations list."
        );

        setTimeout(function(){
            window.location.href = "owner-violations.html";
        }, 1500);

        return;
    }

    try{

        const [violationsResult, appeals] = await Promise.all([
            ownerApiRequest("/owner/violations/mine?page=1&limit=100", token),
            ownerApiRequest("/owner/appeals/mine", token)
        ]);

        const violations = Array.isArray(violationsResult?.violations) ? violationsResult.violations : [];

        currentRecord = violations.find(function(item){
            return item._id === violationId;
        });

        if(!currentRecord){

            showError(
                "Violation Not Found",
                "That violation record could not be found on your account."
            );

            setTimeout(function(){
                window.location.href = "owner-violations.html";
            }, 1500);

            return;
        }

        const existingAppeal = (Array.isArray(appeals) ? appeals : []).find(function(appeal){

            const appealViolationId = appeal.violation && typeof appeal.violation === "object"
                ? appeal.violation._id
                : appeal.violation;

            return appealViolationId === violationId;

        });

        if(existingAppeal){

            showInfo(
                "Appeal Already Filed",
                "You have already filed an appeal for this violation."
            );

            setTimeout(function(){
                window.location.href = "owner-violations.html";
            }, 1500);

            return;
        }

    }
    catch(error){

        console.error("Unable to load violation for appeal:", error);

        showError(
            "Unable to Load Violation",
            error.message || "Please try again."
        );

        setTimeout(function(){
            window.location.href = "owner-violations.html";
        }, 1500);

        return;
    }

    const date = currentRecord.dateTime
        ? new Date(currentRecord.dateTime).toLocaleString("en-PH",{
            month:"long",
            day:"numeric",
            year:"numeric",
            hour:"numeric",
            minute:"2-digit"
        })
        : "";

    document.getElementById("plateNumber").value = currentRecord.plateNumber || "";
    document.getElementById("recordId").value = (currentRecord._id || "").slice(-8).toUpperCase();
    document.getElementById("violationType").value = currentRecord.violationType || "";
    document.getElementById("violationDate").value = date;
    document.getElementById("violationLocation").value = currentRecord.location || "";

}

// ==========================================
// REASON DROPDOWN
// ==========================================

function setupReasonDropdown(){

    const reason = document.getElementById("appealReason");
    const otherGroup = document.getElementById("otherReasonGroup");
    const otherInput = document.getElementById("otherReason");

    reason.addEventListener("change", function(){

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
// SUBMIT APPEAL (to backend)
// ==========================================

async function submitAppeal(){

    if(!currentRecord){
        return;
    }

    let reason = document.getElementById("appealReason").value;
    const otherInput = document.getElementById("otherReason");
    const explanation = document.getElementById("explanation").value.trim();

    if(reason === ""){

        showError(
            "Missing Reason",
            "Please select a reason for your appeal."
        );

        return;
    }

    if(reason === "Others"){

        if(!otherInput || otherInput.value.trim() === ""){

            showError(
                "Specify Reason",
                "Please specify your reason for appeal."
            );

            return;
        }

        reason = otherInput.value.trim();
    }

    if(explanation === ""){

        showError(
            "Missing Explanation",
            "Please provide an explanation to support your appeal."
        );

        return;
    }

    const submitButton = document.getElementById("submitAppealBtn");
    const originalHtml = submitButton ? submitButton.innerHTML : "";

    if(submitButton){
        submitButton.disabled = true;
        submitButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;
    }

    try{

        await ownerApiRequest(
            "/owner/appeals",
            currentOwnerToken,
            {
                method:"POST",
                body:JSON.stringify({
                    violationId: currentRecord._id,
                    reason: reason,
                    supportingDetails: explanation
                })
            }
        );

    }
    catch(error){

        console.error("Unable to submit appeal:", error);

        if(submitButton){
            submitButton.disabled = false;
            submitButton.innerHTML = originalHtml;
        }

        showError(
            "Submission Failed",
            error.message || "Unable to submit your appeal. Please try again."
        );

        return;

    }

    localStorage.removeItem("plateTrackCurrentAppealViolationId");

    showSuccess(
        "Appeal Submitted",
        "Your appeal has been submitted successfully.<br><br>It is now pending review. You can check its status from your violations list.",
        function(){
            window.location.href = "owner-violations.html";
        },
        "Back to Violations"
    );

}
