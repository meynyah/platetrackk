// ==========================================
// PlateTrack | Owner Profile
// ==========================================
//
// Reads the same session the rest of the owner app uses (set at login by
// owner-login.js): "plateTrackOwnerToken" (JWT) + "plateTrackOwnerUser"
// (JSON-encoded owner object). Previously this file looked for an
// unrelated "plateTrackOwnerSession" key holding a plain email string, and
// an unrelated "plateTrackOwners" array that nothing else in the app ever
// populates — so it always failed to find the signed-in user and bounced
// back to the login page. That's what looked like an automatic logout.

let currentOwner = null;

const AVATAR_STORAGE_PREFIX = "plateTrackOwnerAvatar_";

document.addEventListener("DOMContentLoaded", function(){

    currentOwner = requireOwnerSession();

    if(!currentOwner){
        return;
    }

    loadProfile();

});

// ==========================================
// SESSION HELPERS
// ==========================================

function avatarKey(){
    return currentOwner ? AVATAR_STORAGE_PREFIX + currentOwner.id : null;
}

function requireOwnerSession(){

    const token = localStorage.getItem("plateTrackOwnerToken");
    const raw = localStorage.getItem("plateTrackOwnerUser");

    if(!token || !raw){
        window.location.href = "owner-login.html";
        return null;
    }

    try{
        const owner = JSON.parse(raw);
        if(!owner || !owner.id){
            throw new Error("Malformed session");
        }
        return owner;
    }catch(error){
        console.error("Invalid owner session:", error);
        localStorage.removeItem("plateTrackOwnerToken");
        localStorage.removeItem("plateTrackOwnerUser");
        window.location.href = "owner-login.html";
        return null;
    }

}

// ==========================================
// LOAD PROFILE
// ==========================================

function loadProfile(){

    if(!currentOwner){
        return;
    }

    document.getElementById("ownerName").textContent = currentOwner.fullName;
    document.getElementById("emailText").textContent = currentOwner.email;
    document.getElementById("contactText").textContent = currentOwner.contactNumber || "Not provided";

    // The owner account model doesn't currently store a separate address
    // field — only registered plate number and contact number.
    document.getElementById("addressText").textContent = "Not provided";

    if(currentOwner.createdAt){

        const date = new Date(currentOwner.createdAt);

        if(!Number.isNaN(date.getTime())){
            document.getElementById("joinedDate").textContent =
            "Member since " + date.toLocaleDateString("en-US",{ year:"numeric", month:"long" });
        }

    }

    loadVehicles();

    loadAvatar();

}

// ==========================================
// PROFILE PICTURE UPLOAD (stored locally on this device only)
// ==========================================

function loadAvatar(){

    const img = document.getElementById("avatarImage");
    const icon = document.getElementById("avatarIcon");
    const saved = avatarKey() ? localStorage.getItem(avatarKey()) : null;

    if(saved){

        img.src = saved;
        img.style.display = "block";
        icon.style.display = "none";

    }
    else{

        img.style.display = "none";
        icon.style.display = "block";

    }

}

document.addEventListener("DOMContentLoaded", function(){

    const avatarInput = document.getElementById("avatarUploadInput");

    if(!avatarInput){
        return;
    }

    avatarInput.addEventListener("change", function(e){

        const file = e.target.files[0];

        if(!file){
            return;
        }

        if(!file.type.startsWith("image/")){

            showError(
                "Invalid File",
                "Please select an image file (JPG, PNG, etc.)."
            );

            return;
        }

        const reader = new FileReader();

        reader.onload = function(event){

            const img = new Image();

            img.onload = function(){

                // Resize down before storing, since this is saved as
                // base64 text in localStorage, which has a limited quota.
                const maxSize = 300;
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));

                const canvas = document.createElement("canvas");

                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);

                const ctx = canvas.getContext("2d");

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

                try{

                    localStorage.setItem(avatarKey(), dataUrl);

                    loadAvatar();

                    showSuccess(
                        "Profile Picture Updated",
                        "Your profile picture has been saved on this device."
                    );

                }
                catch(error){

                    console.error("Unable to save profile picture:", error);

                    showError(
                        "Upload Failed",
                        "Unable to save the profile picture. Your browser storage may be full."
                    );

                }

            };

            img.src = event.target.result;

        };

        reader.readAsDataURL(file);

        // Reset the input so selecting the same file again still fires "change"
        avatarInput.value = "";

    });

});

// ==========================================
// VEHICLES LIST
// ==========================================
// Owner accounts currently register exactly one plate number (there's no
// multi-vehicle support in the backend yet), so this shows that single
// registered plate as a read-only entry rather than a phantom editable
// list.

function loadVehicles(){

    const vehicleList = document.getElementById("vehicleList");

    if(!vehicleList){
        return;
    }

    vehicleList.innerHTML = "";

    if(!currentOwner || !currentOwner.plateNumber){

        vehicleList.innerHTML = `
            <div class="vehicle-item">
                <div class="info-icon">
                    <i class="fa-solid fa-circle-info"></i>
                </div>
                <div class="vehicle-item-content">
                    <span class="vehicle-item-plate">No registered vehicle</span>
                </div>
            </div>
        `;

        return;
    }

    vehicleList.innerHTML = `
        <div class="vehicle-item">
            <div class="info-icon">
                <i class="fa-solid fa-car"></i>
            </div>
            <div class="vehicle-item-content">
                <span class="vehicle-item-plate">${currentOwner.plateNumber}</span>
                <span class="vehicle-item-detail">Registered to your account</span>
            </div>
        </div>
    `;

}

function openAddVehicleModal(){
    showInfo(
        "Not Available Yet",
        "Adding additional vehicles isn't supported yet — each account currently supports one registered plate number."
    );
}

// The vehicle modal itself is no longer opened (see openAddVehicleModal
// above), but its Cancel/Save buttons in the HTML still reference these
// function names, so we keep no-op stubs to avoid a console error if the
// modal is ever shown by other means.
function closeVehicleModal(){
    const modal = document.getElementById("vehicleModal");
    if(modal) modal.classList.remove("show");
}

function saveVehicle(){
    closeVehicleModal();
}

function openEditVehicleModal(){
    showInfo(
        "Not Available Yet",
        "Editing your registered plate number from here isn't connected to the server yet."
    );
}

function deleteVehicle(){
    showInfo(
        "Not Available Yet",
        "Removing your registered vehicle isn't available from here yet."
    );
}

// ==========================================
// EDIT PROFILE MODAL
// ==========================================

function openEditModal(){

    if(!currentOwner) return;

    document.getElementById("editEmail").value = currentOwner.email;
    document.getElementById("editContact").value = currentOwner.contactNumber || "";
    document.getElementById("editAddress").value = "";

    document.getElementById("editModal").classList.add("show");

}

function closeEditModal(){

    document.getElementById("editModal").classList.remove("show");

}

function saveProfile(){

    const newEmail = document.getElementById("editEmail").value.trim().toLowerCase();
    const newContact = document.getElementById("editContact").value.trim();
    const newAddress = document.getElementById("editAddress").value.trim();

    if(newEmail === "" || newContact === "" || newAddress === ""){

        showError(
            "Incomplete Information",
            "Please complete all profile fields."
        );

        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(!emailPattern.test(newEmail)){

        showError(
            "Invalid Email",
            "Please enter a valid email address."
        );

        return;
    }

    // Editing profile details isn't wired up to the backend yet — there's
    // no PATCH /api/owner/profile endpoint to persist this to your
    // account. Rather than pretend it saved, we say so plainly.
    closeEditModal();
    showInfo(
        "Not Available Yet",
        "Editing your profile details isn't connected to the server yet, so changes here won't be saved to your account. This is a planned feature."
    );

}

// ==========================================
// CHANGE PASSWORD MODAL
// ==========================================

function openPasswordModal(){

    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";

    document.getElementById("passwordModal").classList.add("show");

}

function closePasswordModal(){

    document.getElementById("passwordModal").classList.remove("show");

}

function savePassword(){

    const currentPassword = document.getElementById("currentPassword").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();

    if(currentPassword === "" || newPassword === "" || confirmPassword === ""){

        showError(
            "Incomplete Information",
            "Please complete all password fields."
        );

        return;
    }

    if(newPassword.length < 8){

        showError(
            "Weak Password",
            "Your new password must be at least 8 characters long."
        );

        return;
    }

    if(newPassword !== confirmPassword){

        showError(
            "Password Mismatch",
            "The new password and confirmation password do not match."
        );

        return;
    }

    // Changing your password from here isn't wired up to the backend yet.
    // (Note: unlike the enforcer app, the owner "Forgot Password" flow is
    // ALSO not connected to the backend right now — see the chat for
    // details. Don't point users there until that's fixed too.)
    closePasswordModal();
    showInfo(
        "Not Available Yet",
        "Changing your password from this screen isn't connected to the server yet. This is a planned feature."
    );

}

// ==========================================
// CLICK OUTSIDE MODAL
// ==========================================

window.addEventListener("click", function(event){

    ["editModal","passwordModal","vehicleModal","globalModal"]

    .forEach(function(id){

        const modal = document.getElementById(id);

        if(event.target === modal){

            modal.classList.remove("show");

        }

    });

});

window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveProfile = saveProfile;
window.openPasswordModal = openPasswordModal;
window.closePasswordModal = closePasswordModal;
window.savePassword = savePassword;
window.openAddVehicleModal = openAddVehicleModal;
window.openEditVehicleModal = openEditVehicleModal;
window.deleteVehicle = deleteVehicle;
window.closeVehicleModal = closeVehicleModal;
window.saveVehicle = saveVehicle;
