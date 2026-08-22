// PlateTrack | Traffic Enforcer Profile
//
// Reads the same session the rest of the app uses (set at login by
// script.js): "plateTrackToken" (JWT) + "plateTrackEnforcerSession"
// (JSON-encoded enforcer object). Previously this file looked for an
// unrelated "plateTrackEnforcers" array that nothing else in the app ever
// populates, so it always failed to find the signed-in user and bounced
// back to the login page — this is what looked like an automatic logout.

let currentEnforcer = null;

const AVATAR_STORAGE_PREFIX = "plateTrackEnforcerAvatar_";

function avatarKey(){
    return currentEnforcer ? AVATAR_STORAGE_PREFIX + currentEnforcer.id : null;
}

function requireEnforcerSession(){
    const token = localStorage.getItem("plateTrackToken");
    const raw = localStorage.getItem("plateTrackEnforcerSession");

    if(!token || !raw){
        window.location.href = "enforcer-login.html";
        return null;
    }

    try{
        const enforcer = JSON.parse(raw);
        if(!enforcer || !enforcer.id){
            throw new Error("Malformed session");
        }
        return enforcer;
    }catch(error){
        console.error("Invalid enforcer session:", error);
        localStorage.removeItem("plateTrackToken");
        localStorage.removeItem("plateTrackEnforcerSession");
        window.location.href = "enforcer-login.html";
        return null;
    }
}

function setText(id, value){
    const element = document.getElementById(id);
    if(element) element.textContent = value;
}

function getInputValue(id){
    return document.getElementById(id).value.trim();
}

function loadAvatar(){
    const image = document.getElementById("avatarImage");
    const icon = document.getElementById("avatarIcon");
    const saved = avatarKey() ? localStorage.getItem(avatarKey()) : null;
    const hasPicture = Boolean(saved);
    image.style.display = hasPicture ? "block" : "none";
    icon.style.display = hasPicture ? "none" : "block";
    if(hasPicture) image.src = saved;
}

function loadProfile(){
    if(!currentEnforcer) return;
    const registered = currentEnforcer.createdAt ? new Date(currentEnforcer.createdAt) : null;
    setText("officerName", currentEnforcer.fullName || "Traffic Enforcer");
    setText("badgeNumber", "Badge No. " + (currentEnforcer.badgeNumber || "Not provided"));
    setText("emailText", currentEnforcer.email);
    setText("contactText", currentEnforcer.mobile || "Not provided");
    setText("areaText", currentEnforcer.station || "Antipolo City");
    setText("joinedDate", registered && !Number.isNaN(registered.getTime()) ? "Joined " + registered.getFullYear() : "Joined 2026");
    loadAvatar();
}

function openEditModal(){
    if(!currentEnforcer) return;
    document.getElementById("editEmail").value = currentEnforcer.email;
    document.getElementById("editContact").value = currentEnforcer.mobile || "";
    document.getElementById("editArea").value = currentEnforcer.station || "Antipolo City";
    document.getElementById("editModal").classList.add("show");
}

function closeEditModal(){ document.getElementById("editModal").classList.remove("show"); }

function saveProfile(){
    const email = getInputValue("editEmail").toLowerCase();
    const mobile = getInputValue("editContact");
    const assignedArea = getInputValue("editArea");
    if(!email || !mobile || !assignedArea){ showError("Incomplete Profile", "Please complete all profile fields."); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showError("Invalid Email", "Please enter a valid email address."); return; }
    if(!/^09\d{9}$/.test(mobile)){ showError("Invalid Contact Number", "Please enter a valid 11-digit Philippine mobile number."); return; }

    // Editing profile details isn't wired up to the backend yet — there's
    // no PATCH /api/enforcer/profile endpoint to persist this to your
    // account. Rather than pretend it saved, we say so plainly.
    closeEditModal();
    showInfo(
        "Not Available Yet",
        "Editing your profile details isn't connected to the server yet, so changes here won't be saved to your account. This is a planned feature."
    );
}

function openPasswordModal(){
    ["currentPassword", "newPassword", "confirmPassword"].forEach(function(id){ document.getElementById(id).value = ""; });
    document.getElementById("passwordModal").classList.add("show");
}

function closePasswordModal(){ document.getElementById("passwordModal").classList.remove("show"); }

function savePassword(){
    const currentPassword = getInputValue("currentPassword");
    const newPassword = getInputValue("newPassword");
    const confirmPassword = getInputValue("confirmPassword");
    if(!currentPassword || !newPassword || !confirmPassword){ showError("Incomplete Password", "Please complete all password fields."); return; }
    if(!(newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /\d/.test(newPassword))){
        showError("Weak Password", "Use at least 8 characters with uppercase, lowercase, and a number."); return;
    }
    if(newPassword !== confirmPassword){ showError("Password Mismatch", "The new passwords do not match."); return; }

    // Changing your password from here isn't wired up to the backend yet.
    // Use "Forgot Password" from the login screen instead — that flow does
    // hit the real server and will actually update your account.
    closePasswordModal();
    showInfo(
        "Not Available Yet",
        "Changing your password from this screen isn't connected to the server yet. Use \"Forgot Password\" on the login screen instead — that one works."
    );
}

function handleAvatarUpload(event){
    const input = event.target;
    const file = input.files[0];
    if(!file) return;
    if(!["image/jpeg", "image/png", "image/webp"].includes(file.type)){ showError("Invalid File", "Select a JPG, PNG, or WebP image."); input.value = ""; return; }
    if(file.size > 5 * 1024 * 1024){ showError("Image Too Large", "Select an image smaller than 5 MB."); input.value = ""; return; }
    const reader = new FileReader();
    reader.onload = function(loadEvent){
        const source = new Image();
        source.onload = function(){
            const scale = Math.min(1, 400 / Math.max(source.width, source.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(source.width * scale));
            canvas.height = Math.max(1, Math.round(source.height * scale));
            canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
            try{
                localStorage.setItem(avatarKey(), dataUrl);
                loadAvatar();
                showSuccess("Profile Picture Updated", "Your profile picture has been saved on this device.");
            }catch(error){ showError("Upload Failed", "The image could not be saved. Browser storage may be full."); }
        };
        source.src = loadEvent.target.result;
    };
    reader.readAsDataURL(file);
    input.value = "";
}

function aboutPlateTrack(){
    window.location.href = "settings.html";
}

document.addEventListener("DOMContentLoaded", function(){
    currentEnforcer = requireEnforcerSession();
    if(!currentEnforcer) return;
    loadProfile();
    document.getElementById("avatarUploadInput").addEventListener("change", handleAvatarUpload);
});

window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveProfile = saveProfile;
window.openPasswordModal = openPasswordModal;
window.closePasswordModal = closePasswordModal;
window.savePassword = savePassword;
window.aboutPlateTrack = aboutPlateTrack;
