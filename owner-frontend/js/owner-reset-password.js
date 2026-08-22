// =========================================
// PlateTrack | Owner Reset Password
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const resetEmail = localStorage.getItem("plateTrackOwnerResetEmail");

    if(!resetEmail){

        window.location.href = "owner-forgot-password.html";
        return;

    }

    const form = document.getElementById("resetForm");

    const newPassword = document.getElementById("newPassword");
    const confirmPassword = document.getElementById("confirmPassword");

    const toggleNewPassword = document.getElementById("toggleNewPassword");
    const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

    const resetPasswordBtn = document.getElementById("resetPasswordBtn");

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

    function getOwners(){
        return JSON.parse(localStorage.getItem("plateTrackOwners")) || [];
    }

    function saveOwners(owners){
        localStorage.setItem("plateTrackOwners", JSON.stringify(owners));
    }

    function togglePassword(input, button){

        const icon = button.querySelector("i");

        if(input.type === "password"){
            input.type = "text";
            icon.className = "fa-solid fa-eye-slash";
        }else{
            input.type = "password";
            icon.className = "fa-solid fa-eye";
        }

    }

    toggleNewPassword.addEventListener("click", () => {
        togglePassword(newPassword, toggleNewPassword);
    });

    toggleConfirmPassword.addEventListener("click", () => {
        togglePassword(confirmPassword, toggleConfirmPassword);
    });

    function updateRule(rule, valid,hasTyped){

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

        const password = newPassword.value;

        const hasLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const hasTyped = password.length > 0;

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
            strengthText.textContent = "-";
            strengthText.style.color = "#94a3b8";

            return { score };
        }

        if(score <= 1){
            strengthFill.style.width = "20%";
            strengthFill.style.background = "#ef4444";
            strengthText.textContent = "Weak";
            strengthText.style.color = "#f87171";
        }else if(score === 2){
            strengthFill.style.width = "40%";
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

        return { score };

    }

    function checkPasswordMatch(){

        const password = newPassword.value;
        const confirm = confirmPassword.value;
        const box = confirmPassword.parentElement;

        if(confirm === ""){

            passwordMatch.textContent = "";
            box.classList.remove("success", "error");
            confirmIcon.className = "fa-solid fa-lock-open input-icon";

            return;

        }

        if(password === confirm){

            passwordMatch.innerHTML = '<i class="fa-solid fa-circle-check"></i> Passwords match';
            passwordMatch.className = "password-match success";

            box.classList.remove("error");
            box.classList.add("success");

            confirmIcon.className = "fa-solid fa-circle-check input-icon";

        }else{

            passwordMatch.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Passwords do not match';
            passwordMatch.className = "password-match error";

            box.classList.remove("success");
            box.classList.add("error");

            confirmIcon.className = "fa-solid fa-circle-xmark input-icon";

        }

    }

    newPassword.addEventListener("input", () => {
        checkPassword();
        checkPasswordMatch();
    });

    confirmPassword.addEventListener("input", checkPasswordMatch);

    form.addEventListener("submit", (e) => {

        e.preventDefault();

        const password = newPassword.value.trim();
        const confirm = confirmPassword.value.trim();
        const result = checkPassword();

        if(password === "" || confirm === ""){

            showError(
                "Missing Information",
                "Please complete all required password fields."
            );

            return;

        }

        if(result.score < 5){

            showError(
                "Weak Password",
                "Please follow all password requirements before continuing."
            );

            return;

        }

        if(password !== confirm){

            showError(
                "Password Mismatch",
                "The passwords do not match. Please check your new password and confirmation."
            );

            return;

        }

        resetPasswordBtn.disabled = true;
        resetPasswordBtn.classList.add("loading");

        resetPasswordBtn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Updating Password...
        `;

        setTimeout(() => {

            resetPasswordBtn.classList.remove("loading");
            resetPasswordBtn.classList.add("success");

            resetPasswordBtn.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                Password Updated
            `;

            setTimeout(() => {

                // Actually update the stored password for this account
                const owners = getOwners();

                const ownerIndex = owners.findIndex(function(owner){
                    return owner.email.toLowerCase() === resetEmail.toLowerCase();
                });

                if(ownerIndex !== -1){

                    owners[ownerIndex].password = password;

                    saveOwners(owners);

                }

                localStorage.removeItem("plateTrackOwnerResetEmail");

                showSuccess(
                    "Password Updated",
                    "Your PlateTrack password has been updated successfully.<br><br>You may now sign in using your new password.",
                    () => {
                        window.location.href = "owner-login.html";
                    },
                    "Sign In Now"
                );

                resetPasswordBtn.disabled = false;
                resetPasswordBtn.classList.remove("success");
                resetPasswordBtn.innerHTML = "Reset Password";

            }, 900);

        }, 1800);

    });

    checkPassword();

});
