// =========================================
// PlateTrack | Owner Forgot Password
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("ownerForgotPasswordForm");
    const email = document.getElementById("email");
    const button = document.getElementById("sendCodeButton");

    function getOwners(){
        return JSON.parse(localStorage.getItem("plateTrackOwners")) || [];
    }

    form.addEventListener("submit", (e) => {

        e.preventDefault();

        const emailValue = email.value.trim().toLowerCase();

        if(emailValue === ""){

            showError(
                "Email Required",
                "Please enter your registered email address."
            );

            email.focus();

            return;

        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if(!emailPattern.test(emailValue)){

            showError(
                "Invalid Email",
                "Please enter a valid email address."
            );

            email.focus();

            return;

        }

        const owners = getOwners();

        const matchedOwner = owners.find(function(owner){
            return owner.email.toLowerCase() === emailValue;
        });

        if(!matchedOwner){

            showError(
                "Account Not Found",
                "No vehicle owner account was found for this email address."
            );

            return;

        }

        button.disabled = true;
        button.classList.add("loading");

        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Sending Verification Code...
        `;

        setTimeout(() => {

            button.classList.remove("loading");
            button.classList.add("success");

            button.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                Verification Code Sent
            `;

            setTimeout(() => {

                localStorage.setItem("plateTrackOwnerResetEmail", emailValue);

                showSuccess(
                    "Verification Code Sent",
                    "A 6-digit verification code has been sent to your registered email address.<br><br>Please check your Inbox or Spam folder before continuing.",
                    () => {
                        window.location.href = "owner-verification.html";
                    },
                    "Continue"
                );

                button.disabled = false;
                button.classList.remove("success");
                button.innerHTML = "Send Verification Code";

            }, 900);

        }, 1800);

    });

});
