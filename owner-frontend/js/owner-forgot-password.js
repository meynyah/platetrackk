// =========================================
// PlateTrack | Owner Forgot Password
// =========================================
// This previously checked against a "plateTrackOwners" localStorage array
// that nothing else in the app ever populates, and only ever *simulated*
// sending a code via setTimeout -- no real email was ever sent. It now
// calls the same backend the enforcer flow already uses successfully,
// just with role: "owner".

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("ownerForgotPasswordForm");
    const email = document.getElementById("email");
    const button = document.getElementById("sendCodeButton");

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const emailValue = email.value.trim().toLowerCase();

        if(emailValue === ""){
            showError("Email Required", "Please enter your registered email address.");
            email.focus();
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if(!emailPattern.test(emailValue)){
            showError("Invalid Email", "Please enter a valid email address.");
            email.focus();
            return;
        }

        button.disabled = true;
        button.classList.add("loading");
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending Verification Code...`;

        try{

            const response = await fetch(`${API_BASE}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailValue, role: "owner" })
            });

            const data = await response.json();

            if(!response.ok){
                button.disabled = false;
                button.classList.remove("loading");
                button.innerHTML = "Send Verification Code";
                const title = response.status === 404 ? "Account Not Found" : "Unable to Send Code";
                showError(title, data.message || "No vehicle owner account was found for this email address.");
                return;
            }

            localStorage.setItem("plateTrackOwnerResetEmail", emailValue);

            button.classList.remove("loading");
            button.classList.add("success");
            button.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verification Code Sent`;

            setTimeout(() => {

                showSuccess(
                    "Verification Code Sent",
                    "A 6-digit verification code has been sent to your registered email address.<br><br>Please check your Inbox or Spam folder before continuing.",
                    () => { window.location.href = "owner-verification.html"; },
                    "Continue"
                );

                button.disabled = false;
                button.classList.remove("success");
                button.innerHTML = "Send Verification Code";

            }, 900);

        }
        catch(error){
            button.disabled = false;
            button.classList.remove("loading");
            button.innerHTML = "Send Verification Code";
            showError("Connection Error", "Unable to reach the server. Please try again.");
        }

    });

});
