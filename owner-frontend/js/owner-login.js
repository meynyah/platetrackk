document.addEventListener("DOMContentLoaded", function () {

    // API_BASE comes from shared/js/config.js (loaded before this file).
    const API_URL = `${API_BASE}/auth/owner/login`;

    const loginForm =
        document.getElementById("ownerLoginForm");

    const emailInput =
        document.getElementById("email");

    const passwordInput =
        document.getElementById("password");

    const togglePasswordButton =
        document.getElementById("togglePassword");

    const loginButton =
        document.getElementById("loginButton");

    const rememberDeviceCheckbox =
        document.getElementById("remember");

    if (
        !loginForm ||
        !emailInput ||
        !passwordInput ||
        !loginButton
    ) {
        console.error("Owner login elements are missing.");
        return;
    }

    if (togglePasswordButton) {

        togglePasswordButton.addEventListener(
            "click",
            function () {

                const isHidden =
                    passwordInput.type === "password";

                passwordInput.type =
                    isHidden ? "text" : "password";

                const icon =
                    togglePasswordButton.querySelector("i");

                if (icon) {
                    icon.className =
                        isHidden
                            ? "fa-solid fa-eye-slash"
                            : "fa-solid fa-eye";
                }
            }
        );
    }

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            const email =
                emailInput.value.trim().toLowerCase();

            const password =
                passwordInput.value;

            if (!email || !password) {
                showError(
                    "Incomplete Information",
                    "Please enter your email and password."
                );
                return;
            }

            loginButton.disabled = true;

            loginButton.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Signing in...
            `;

            try {

                const response = await fetch(API_URL, {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email,
                        password,
                        rememberDevice: !!(rememberDeviceCheckbox && rememberDeviceCheckbox.checked)
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    const failure = new Error(
                        data.message || "Unable to sign in."
                    );
                    failure.code = data.code;
                    failure.reason = data.reason;
                    throw failure;
                }

                localStorage.setItem(
                    "plateTrackOwnerToken",
                    data.token
                );

                localStorage.setItem(
                    "plateTrackOwnerUser",
                    JSON.stringify(data.user)
                );

                showSuccess(
                    "Login Successful",
                    `Welcome back, ${data.user.fullName}.`,
                    function () {
                        window.location.href =
                            "owner-dashboard.html";
                    },
                    "Continue"
                );

            } catch (error) {

                loginButton.disabled = false;
                loginButton.innerHTML =
                    "Sign in to My Account";

                const message =
                    error.message || "Unable to sign in.";

                if (error.code === "REGISTRATION_REJECTED") {
                    showError(
                        "Account Not Approved",
                        registrationRejectedMessage(error.reason)
                    );
                    return;
                }

                if (
                    message.toLowerCase()
                        .includes("under review")
                ) {
                    showError(
                        "Account Pending Approval",
                        message
                    );
                    return;
                }

                showError(
                    "Login Failed",
                    message
                );
            }
        }
    );
});
