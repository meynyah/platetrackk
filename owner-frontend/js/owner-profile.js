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

    document.getElementById("addressText").textContent = currentOwner.address || "Not provided";

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

    // The primary/original registered vehicle -- not deletable from here,
    // since it's tied to the account itself.
    let html = `
        <div class="vehicle-item">
            <div class="info-icon">
                <i class="fa-solid fa-car"></i>
            </div>
            <div class="vehicle-item-content">
                <span class="vehicle-item-plate">${currentOwner.plateNumber}</span>
                <span class="vehicle-item-detail">${[currentOwner.vehicleColor, currentOwner.vehicleType].filter(Boolean).join(" ") || "Registered to your account"}</span>
            </div>
        </div>
    `;

    // Any additional vehicles the owner has added since registering.
    const additional = currentOwner.additionalVehicles || [];

    additional.forEach(function(vehicle){

        html += `
            <div class="vehicle-item">
                <div class="info-icon">
                    <i class="fa-solid fa-car"></i>
                </div>
                <div class="vehicle-item-content">
                    <span class="vehicle-item-plate">${vehicle.plateNumber}</span>
                    <span class="vehicle-item-detail">${[vehicle.vehicleColor, vehicle.vehicleType].filter(Boolean).join(" ") || "Additional vehicle"}</span>
                </div>
                <div class="vehicle-actions">
                    <button type="button" onclick="openEditVehicleModal('${vehicle._id}')" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" onclick="deleteVehicle('${vehicle._id}')" title="Remove">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

    });

    vehicleList.innerHTML = html;

}

function openAddVehicleModal(){
    document.getElementById("vehicleModalTitle").textContent = "Add Vehicle";
    document.getElementById("vehicleEditIndex").value = "-1";
    document.getElementById("vehiclePlateInput").value = "";
    document.getElementById("vehicleTypeInput").value = "";
    document.getElementById("vehicleColorInput").value = "";
    document.getElementById("vehicleModal").classList.add("show");
}

function closeVehicleModal(){
    const modal = document.getElementById("vehicleModal");
    if(modal) modal.classList.remove("show");
}

function openEditVehicleModal(vehicleId){

    const vehicle = (currentOwner.additionalVehicles || []).find(function(v){
        return v._id === vehicleId;
    });

    if(!vehicle){
        showError("Vehicle Not Found", "This vehicle could not be found on your account.");
        return;
    }

    document.getElementById("vehicleModalTitle").textContent = "Edit Vehicle";
    document.getElementById("vehicleEditIndex").value = vehicleId;
    document.getElementById("vehiclePlateInput").value = vehicle.plateNumber;
    document.getElementById("vehicleTypeInput").value = vehicle.vehicleType || "";
    document.getElementById("vehicleColorInput").value = vehicle.vehicleColor || "";
    document.getElementById("vehicleModal").classList.add("show");

}

async function saveVehicle(){

    const vehicleId = document.getElementById("vehicleEditIndex").value;
    const plateNumber = document.getElementById("vehiclePlateInput").value.trim();
    const vehicleType = document.getElementById("vehicleTypeInput").value.trim();
    const vehicleColor = document.getElementById("vehicleColorInput").value.trim();

    if(!plateNumber){
        showError("Missing Plate Number", "Please enter the vehicle's plate number.");
        return;
    }

    const token = localStorage.getItem("plateTrackOwnerToken");
    if(!token){ window.location.href = "owner-login.html"; return; }

    const isEditing = vehicleId && vehicleId !== "-1";

    try{

        const response = await fetch(
            isEditing
                ? `${API_BASE}/owner/vehicles/${vehicleId}`
                : `${API_BASE}/owner/vehicles`,
            {
                method: isEditing ? "PATCH" : "POST",
                headers:{
                    "Content-Type":"application/json",
                    "Authorization":`Bearer ${token}`
                },
                body: JSON.stringify({ plateNumber, vehicleType, vehicleColor })
            }
        );

        const data = await response.json().catch(function(){ return {}; });

        if(response.status === 401){
            localStorage.removeItem("plateTrackOwnerToken");
            localStorage.removeItem("plateTrackOwnerUser");
            window.location.href = "owner-login.html";
            return;
        }

        if(!response.ok){
            showError("Unable to Save Vehicle", data.message || "Could not save this vehicle right now.");
            return;
        }

        currentOwner = data.owner;
        localStorage.setItem("plateTrackOwnerUser", JSON.stringify(currentOwner));

        closeVehicleModal();
        loadVehicles();
        showSuccess(
            isEditing ? "Vehicle Updated" : "Vehicle Added",
            isEditing ? "Your vehicle details have been updated." : "Your new vehicle has been added to your account."
        );

    }
    catch(error){

        console.error("Unable to save vehicle:", error);
        showError("Unable to Save Vehicle", "Could not reach the server. Please check your connection and try again.");

    }

}

async function deleteVehicle(vehicleId){

    const token = localStorage.getItem("plateTrackOwnerToken");
    if(!token){ window.location.href = "owner-login.html"; return; }

    try{

        const response = await fetch(
            `${API_BASE}/owner/vehicles/${vehicleId}`,
            {
                method:"DELETE",
                headers:{
                    "Authorization":`Bearer ${token}`
                }
            }
        );

        const data = await response.json().catch(function(){ return {}; });

        if(response.status === 401){
            localStorage.removeItem("plateTrackOwnerToken");
            localStorage.removeItem("plateTrackOwnerUser");
            window.location.href = "owner-login.html";
            return;
        }

        if(!response.ok){
            showError("Unable to Remove Vehicle", data.message || "Could not remove this vehicle right now.");
            return;
        }

        currentOwner = data.owner;
        localStorage.setItem("plateTrackOwnerUser", JSON.stringify(currentOwner));

        loadVehicles();
        showSuccess("Vehicle Removed", "The vehicle has been removed from your account.");

    }
    catch(error){

        console.error("Unable to remove vehicle:", error);
        showError("Unable to Remove Vehicle", "Could not reach the server. Please check your connection and try again.");

    }

}

// ==========================================
// EDIT PROFILE MODAL
// ==========================================

function openEditModal(){

    if(!currentOwner) return;

    document.getElementById("editEmail").value = currentOwner.email;
    document.getElementById("editContact").value = currentOwner.contactNumber || "";
    document.getElementById("editAddress").value = currentOwner.address || "";

    document.getElementById("editModal").classList.add("show");

}

function closeEditModal(){

    document.getElementById("editModal").classList.remove("show");

}

async function saveProfile(){

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

    const token = localStorage.getItem("plateTrackOwnerToken");
    if(!token){ window.location.href = "owner-login.html"; return; }

    try{

        const response = await fetch(
            `${API_BASE}/owner/profile`,
            {
                method:"PATCH",
                headers:{
                    "Content-Type":"application/json",
                    "Authorization":`Bearer ${token}`
                },
                body: JSON.stringify({ email: newEmail, contactNumber: newContact, address: newAddress })
            }
        );

        const data = await response.json().catch(function(){ return {}; });

        if(response.status === 401){
            localStorage.removeItem("plateTrackOwnerToken");
            localStorage.removeItem("plateTrackOwnerUser");
            window.location.href = "owner-login.html";
            return;
        }

        if(!response.ok){
            showError("Unable to Save", data.message || "Could not update your profile right now.");
            return;
        }

        currentOwner = Object.assign({}, currentOwner, {
            email: data.owner.email,
            contactNumber: data.owner.contactNumber,
            address: data.owner.address,
        });
        localStorage.setItem("plateTrackOwnerUser", JSON.stringify(currentOwner));

        closeEditModal();
        showSuccess("Profile Updated", "Your profile details have been saved.");

    }
    catch(error){

        console.error("Unable to update profile:", error);
        showError("Unable to Save", "Could not reach the server. Please check your connection and try again.");

    }

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

async function savePassword(){

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

    const token = localStorage.getItem("plateTrackOwnerToken");
    if(!token){ window.location.href = "owner-login.html"; return; }

    try{

        const response = await fetch(
            `${API_BASE}/owner/password`,
            {
                method:"PATCH",
                headers:{
                    "Content-Type":"application/json",
                    "Authorization":`Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            }
        );

        const data = await response.json().catch(function(){ return {}; });

        if(response.status === 401 && data.message && data.message.toLowerCase().indexOf("incorrect") !== -1){
            showError("Incorrect Password", data.message);
            return;
        }

        if(response.status === 401){
            localStorage.removeItem("plateTrackOwnerToken");
            localStorage.removeItem("plateTrackOwnerUser");
            window.location.href = "owner-login.html";
            return;
        }

        if(!response.ok){
            showError("Unable to Change Password", data.message || "Could not change your password right now.");
            return;
        }

        closePasswordModal();
        showSuccess("Password Changed", "Your password has been updated successfully.");

    }
    catch(error){

        console.error("Unable to change password:", error);
        showError("Unable to Change Password", "Could not reach the server. Please check your connection and try again.");

    }

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
