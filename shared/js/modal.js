// =========================================
// PLATETRACK GLOBAL MODAL
// =========================================

function getModalParts(){

    return {
        modal:document.getElementById("globalModal"),
        icon:document.getElementById("modalIcon"),
        title:document.getElementById("modalTitle"),
        message:document.getElementById("modalMessage"),
        buttons:document.getElementById("modalButtons")
    };

}

function openModal(){

    const parts = getModalParts();

    if(!parts.modal){
        return;
    }

    parts.modal.classList.add("show");

}

function closeModal(){

    const parts = getModalParts();

    if(!parts.modal){
        return;
    }

    parts.modal.classList.remove("show");

}

function setModalIcon(type){

    const parts = getModalParts();

    if(!parts.icon){
        return;
    }

    parts.icon.className = "modal-icon " + type;

    if(type === "success"){
        parts.icon.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    }
    else if(type === "error"){
        parts.icon.innerHTML = `<i class="fa-solid fa-circle-xmark"></i>`;
    }
    else if(type === "warning"){
        parts.icon.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;
    }
    else{
        parts.icon.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
    }

}

function showSuccess(title,message,callback = null,buttonText = "Continue"){

    const parts = getModalParts();

    if(!parts.modal || !parts.title || !parts.message || !parts.buttons){

        alert(title + "\n\n" + message);

        if(typeof callback === "function"){
            callback();
        }

        return;

    }

    setModalIcon("success");

    parts.title.textContent = title;
    parts.message.innerHTML = String(message).replace(/\n/g,"<br>");

    parts.buttons.innerHTML = `
        <button class="modal-btn modal-ok" id="modalOkButton">
            ${buttonText}
        </button>
    `;

    openModal();

    document.getElementById("modalOkButton").onclick = function(){

        closeModal();

        if(typeof callback === "function"){
            callback();
        }

    };

}

function showError(title,message,buttonText = "Try Again"){

    const parts = getModalParts();

    if(!parts.modal || !parts.title || !parts.message || !parts.buttons){
        alert(title + "\n\n" + message);
        return;
    }

    setModalIcon("error");

    parts.title.textContent = title;
    parts.message.innerHTML = String(message).replace(/\n/g,"<br>");

    parts.buttons.innerHTML = `
        <button class="modal-btn modal-ok" onclick="closeModal()">
            ${buttonText}
        </button>
    `;

    openModal();

}

function showWarning(title,message,buttonText = "OK"){

    const parts = getModalParts();

    if(!parts.modal || !parts.title || !parts.message || !parts.buttons){
        alert(title + "\n\n" + message);
        return;
    }

    setModalIcon("warning");

    parts.title.textContent = title;
    parts.message.innerHTML = String(message).replace(/\n/g,"<br>");

    parts.buttons.innerHTML = `
        <button class="modal-btn modal-ok" onclick="closeModal()">
            ${buttonText}
        </button>
    `;

    openModal();

}

function showInfo(title,message,buttonText = "Got it"){

    const parts = getModalParts();

    if(!parts.modal || !parts.title || !parts.message || !parts.buttons){
        alert(title + "\n\n" + message);
        return;
    }

    setModalIcon("info");

    parts.title.textContent = title;
    parts.message.innerHTML = String(message).replace(/\n/g,"<br>");

    parts.buttons.innerHTML = `
        <button class="modal-btn modal-ok" onclick="closeModal()">
            ${buttonText}
        </button>
    `;

    openModal();

}

function showConfirm(title,message,onConfirm,confirmText = "Confirm",cancelText = "Cancel"){

    const parts = getModalParts();

    if(!parts.modal || !parts.title || !parts.message || !parts.buttons){

        const confirmed = confirm(title + "\n\n" + message);

        if(confirmed && typeof onConfirm === "function"){
            onConfirm();
        }

        return;

    }

    setModalIcon("warning");

    parts.title.textContent = title;
    parts.message.innerHTML = String(message).replace(/\n/g,"<br>");

    parts.buttons.innerHTML = `
        <button class="modal-btn modal-cancel" id="modalCancelButton">
            ${cancelText}
        </button>

        <button class="modal-btn modal-danger" id="modalConfirmButton">
            ${confirmText}
        </button>
    `;

    openModal();

    document.getElementById("modalCancelButton").onclick = closeModal;

    document.getElementById("modalConfirmButton").onclick = function(){

        closeModal();

        if(typeof onConfirm === "function"){
            onConfirm();
        }

    };

}

window.addEventListener("click",function(e){

    const modal = document.getElementById("globalModal");

    if(modal && e.target === modal){
        closeModal();
    }

});

document.addEventListener("keydown",function(e){

    if(e.key === "Escape"){
        closeModal();
    }

});