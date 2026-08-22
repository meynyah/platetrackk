// =========================================
// PlateTrack | Enforcer Register
// =========================================

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const progressFill = document.getElementById("progressFill");
const stepText = document.getElementById("stepText");

const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");

const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

const registerBtn = document.getElementById("registerBtn");

const strengthFill = document.getElementById("strengthFill");
const strengthText = document.getElementById("strengthText");

const confirmIcon = document.getElementById("confirmIcon");
const passwordMatch = document.getElementById("passwordMatch");

const rules = {
    length: document.getElementById("ruleLength"),
    upper: document.getElementById("ruleUpper"),
    lower: document.getElementById("ruleLower"),
    number: document.getElementById("ruleNumber"),
    special: document.getElementById("ruleSpecial")
};

function nextStep(){

    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const badgeNumber = document.getElementById("badgeNumber").value.trim();

    if(firstName === "" || lastName === "" || badgeNumber === ""){
        showError("Incomplete Information", "Please complete all required personal information fields.");
        return;
    }

    step1.style.display = "none";
    step2.style.display = "block";

    progressFill.style.width = "100%";
    stepText.textContent = "Step 2 of 2";
}

function previousStep(){

    step2.style.display = "none";
    step1.style.display = "block";

    progressFill.style.width = "50%";
    stepText.textContent = "Step 1 of 2";
}

function toggle(input, button){

    const icon = button.querySelector("i");

    if(input.type === "password"){
        input.type = "text";
        icon.className = "fa-solid fa-eye-slash";
    }else{
        input.type = "password";
        icon.className = "fa-solid fa-eye";
    }
}

togglePassword.addEventListener("click", () => {
    toggle(password, togglePassword);
});

toggleConfirmPassword.addEventListener("click", () => {
    toggle(confirmPassword, toggleConfirmPassword);
});

function updateRule(rule, valid, hasTyped){

    const icon = rule.querySelector("i");

    rule.classList.remove("valid", "invalid");

    if(!hasTyped){
        icon.className = "fa-regular fa-circle";
        return;
    }

    if(valid){
        rule.classList.add("valid");
        icon.className = "fa-solid fa-circle-check";
    }else{
        rule.classList.add("invalid");
        icon.className = "fa-solid fa-circle-xmark";
    }
}

function checkPassword(){

    const value = password.value;

    const hasTyped = value.length > 0;
    const hasLength = value.length >= 8;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    updateRule(rules.length, hasLength, hasTyped);
    updateRule(rules.upper, hasUpper, hasTyped);
    updateRule(rules.lower, hasLower, hasTyped);
    updateRule(rules.number, hasNumber, hasTyped);
    updateRule(rules.special, hasSpecial, hasTyped);

    let score = 0;

    if(hasLength) score++;
    if(hasUpper) score++;
    if(hasLower) score++;
    if(hasNumber) score++;
    if(hasSpecial) score++;

    if(!hasTyped){
        strengthFill.style.width = "0%";
        strengthFill.style.background = "#223656";
        strengthText.textContent = "—";
        return score;
    }

    if(score <= 1){
        strengthFill.style.width = "20%";
        strengthFill.style.background = "#ef4444";
        strengthText.textContent = "Weak";
        strengthText.style.color = "#f87171";
    }else if(score === 2){
        strengthFill.style.width = "45%";
        strengthFill.style.background = "#f97316";
        strengthText.textContent = "Fair";
        strengthText.style.color = "#fb923c";
    }else if(score === 3 || score === 4){
        strengthFill.style.width = "75%";
        strengthFill.style.background = "#facc15";
        strengthText.textContent = "Good";
        strengthText.style.color = "#fde047";
    }else{
        strengthFill.style.width = "100%";
        strengthFill.style.background = "#22c55e";
        strengthText.textContent = "Strong";
        strengthText.style.color = "#4ade80";
    }

    return score;
}

function checkPasswordMatch(){

    const box = confirmPassword.parentElement;

    if(confirmPassword.value === ""){
        passwordMatch.textContent = "";
        passwordMatch.className = "password-match";
        box.classList.remove("success", "error");
        confirmIcon.className = "fa-solid fa-lock-open input-icon";
        return false;
    }

    if(password.value === confirmPassword.value){
        passwordMatch.innerHTML = '<i class="fa-solid fa-circle-check"></i> Passwords match';
        passwordMatch.className = "password-match success";
        box.classList.remove("error");
        box.classList.add("success");
        confirmIcon.className = "fa-solid fa-circle-check input-icon";
        return true;
    }

    passwordMatch.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Passwords do not match';
    passwordMatch.className = "password-match error";
    box.classList.remove("success");
    box.classList.add("error");
    confirmIcon.className = "fa-solid fa-circle-xmark input-icon";
    return false;
}

password.addEventListener("input", () => {
    checkPassword();
    checkPasswordMatch();
});

confirmPassword.addEventListener("input", checkPasswordMatch);

registerBtn.addEventListener("click", async function(){

    const email = document.getElementById("email").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const agreement = document.getElementById("agreement");

    const score = checkPassword();
    const isMatch = checkPasswordMatch();

    if(email === "" || password.value === "" || confirmPassword.value === ""){
        showError("Incomplete Information", "Please complete all required account information fields.");
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(!emailPattern.test(email)){
        showError("Invalid Email", "Please enter a valid official email address.");
        return;
    }

    if(mobile !== "" && !/^09\d{9}$/.test(mobile)){
        showError("Invalid Mobile Number", "Please enter a valid 11-digit Philippine mobile number.");
        return;
    }

    if(score < 5){
        showError("Weak Password", "Please follow all password requirements before creating your account.");
        return;
    }

    if(!isMatch){
        showError("Password Mismatch", "Your passwords do not match. Please check your confirmation password.");
        return;
    }

    if(!agreement.checked){
        showError("Agreement Required", "Please certify that you are an authorized Traffic Enforcer.");
        return;
    }

    const fullName = document.getElementById("firstName").value.trim() + " " + document.getElementById("lastName").value.trim();
    const badgeNumber = document.getElementById("badgeNumber").value.trim();

    registerBtn.disabled = true;
    registerBtn.classList.add("loading");

    registerBtn.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Creating Secure Account...
    `;

    try {

        const response = await fetch(`${API_BASE_URL}/api/auth/enforcer/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName,
                email,
                badgeNumber,
                mobile,
                password: password.value
            })
        });

        const data = await response.json();

        if(!response.ok){
            registerBtn.disabled = false;
            registerBtn.classList.remove("loading");
            registerBtn.innerHTML = "Create Account";
            showError("Registration Failed", data.message || "Unable to complete registration. Please try again.");
            return;
        }

        registerBtn.classList.remove("loading");
        registerBtn.classList.add("success");

        registerBtn.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            Registration Submitted
        `;

        setTimeout(() => {

            showSuccess(
                "Registration Submitted",
                "Your registration has been submitted successfully.<br><br>Your account is now pending administrator approval.<br><br>You will receive an email once your account has been reviewed.",
                () => {
                    window.location.href = "enforcer-login.html";
                },
                "Back to Login"
            );

            registerBtn.disabled = false;
            registerBtn.classList.remove("success");
            registerBtn.innerHTML = "Create Account";

        }, 900);

    } catch (error) {
        registerBtn.disabled = false;
        registerBtn.classList.remove("loading");
        registerBtn.innerHTML = "Create Account";
        showError("Connection Error", "Unable to reach the server. Please try again.");
    }

});