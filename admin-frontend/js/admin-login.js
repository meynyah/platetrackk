// ==========================================
// PlateTrack Admin Login V2
// ==========================================

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const toggleAdminPassword = document.getElementById(
    "toggleAdminPassword"
);

// Redirect authenticated administrator
if (Auth.getToken()) {
    window.location.replace("admin-dashboard.html");
}

// Show / hide password
toggleAdminPassword.addEventListener("click", () => {

    const icon = toggleAdminPassword.querySelector("i");

    const showPassword =
        passwordInput.type === "password";

    passwordInput.type =
        showPassword ? "text" : "password";

    icon.className = showPassword
        ? "fa-solid fa-eye-slash"
        : "fa-solid fa-eye";

    toggleAdminPassword.setAttribute(
        "aria-label",
        showPassword
            ? "Hide password"
            : "Show password"
    );

});

// Submit login
loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    loginError.textContent = "";
    loginError.classList.remove("show");

    const email = emailInput.value
        .trim()
        .toLowerCase();

    const password = passwordInput.value;

    if(!email || !password){

        showLoginError(
            "Please enter your administrator email and password."
        );

        return;
    }

    setLoginLoading(true);

    try{

        const data = await apiRequest(
            "/auth/admin/login",
            {
                method:"POST",
                body:{
                    email,
                    password
                }
            }
        );

        if(!data || !data.token || !data.user){

            throw new Error(
                "The server returned an incomplete authentication response."
            );

        }

        Auth.saveSession(
            data.token,
            data.user
        );

        loginButton.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <span>Access Granted</span>
        `;

        loginButton.style.background =
            "linear-gradient(135deg,#24a968,#187d4e)";

        setTimeout(() => {

            window.location.replace("admin-dashboard.html");

        },700);

    }catch(error){

        showLoginError(
            error.message ||
            "Administrator sign in failed."
        );

        setLoginLoading(false);
    }

});

function setLoginLoading(isLoading){

    loginButton.disabled = isLoading;

    if(isLoading){

        loginButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Verifying Credentials...</span>
        `;

        return;
    }

    loginButton.innerHTML = `
        <span class="button-text">
            Sign in to Command Center
        </span>

        <i class="fa-solid fa-arrow-right-to-bracket"></i>
    `;

    loginButton.style.background = "";
}

function showLoginError(message){

    loginError.textContent = message;
    loginError.classList.add("show");
}
