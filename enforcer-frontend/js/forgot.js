// =========================================
// PlateTrack | Forgot Password
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("forgotPasswordForm");
    const email = document.getElementById("email");
    const button = document.getElementById("sendCodeButton");

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const emailValue = email.value.trim();

        if(emailValue === ""){
            showError("Email Required", "Please enter your registered PlateTrack email address.");
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

        try {

            const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailValue, role: "enforcer" })
            });

            const data = await response.json();

            if(!response.ok){
                button.disabled = false;
                button.classList.remove("loading");
                button.innerHTML = "Send Verification Code";
                showError("Account Not Found", data.message || "No account was found for this email address.");
                return;
            }

            localStorage.setItem("resetEmail", emailValue);
            localStorage.setItem("resetRole", "enforcer");

            button.classList.remove("loading");
            button.classList.add("success");
            button.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verification Code Sent`;

            setTimeout(() => {

                showSuccess(
                    "Verification Code Sent",
                    "A 6-digit verification code has been sent to your registered email address.<br><br>Please check your Inbox or Spam folder before continuing.",
                    () => { window.location.href = "verification.html"; },
                    "Continue"
                );

                button.disabled = false;
                button.classList.remove("success");
                button.innerHTML = "Send Verification Code";

            }, 900);

        } catch (error) {
            button.disabled = false;
            button.classList.remove("loading");
            button.innerHTML = "Send Verification Code";
            showError("Connection Error", "Unable to reach the server. Please try again.");
        }

    });

});