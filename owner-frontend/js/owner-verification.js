// =========================================
// PlateTrack | Owner Email Verification
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("verificationForm");
    const inputs = document.querySelectorAll(".code-input");
    const verifyBtn = document.getElementById("verifyBtn");
    const resendBtn = document.getElementById("resendCode");
    const verificationBox = document.getElementById("verificationBox");
    const maskedEmail = document.getElementById("maskedEmail");

    const resetEmail = localStorage.getItem("plateTrackOwnerResetEmail");

    if(!resetEmail){

        window.location.href = "owner-forgot-password.html";
        return;

    }

    function maskEmail(email){
        const parts = email.split("@");

        if(parts.length !== 2){
            return email;
        }

        const name = parts[0];
        const domain = parts[1];
        const visible = name.length <= 2 ? name[0] : name.slice(0,2);

        return `${visible}${"*".repeat(Math.max(name.length - 2, 4))}@${domain}`;
    }

    if(maskedEmail){
        maskedEmail.textContent = maskEmail(resetEmail);
    }

    // OTP input behavior

    inputs.forEach((input, index) => {

        input.addEventListener("input", function () {

            this.value = this.value.replace(/\D/g, "");

            if(this.value !== ""){
                this.classList.add("filled");
            }else{
                this.classList.remove("filled");
            }

            if(this.value.length === 1 && index < inputs.length - 1){
                inputs[index + 1].focus();
            }

        });

        input.addEventListener("keydown", function (e) {

            if(e.key === "Backspace"){

                if(this.value === "" && index > 0){
                    inputs[index - 1].focus();
                }else{
                    this.value = "";
                    this.classList.remove("filled");
                    this.classList.remove("success");
                }

            }

        });

    });

    // Paste support

    inputs[0].addEventListener("paste", function (e) {

        e.preventDefault();

        const paste = (e.clipboardData || window.clipboardData)
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);

        paste.split("").forEach((digit, i) => {

            if(inputs[i]){
                inputs[i].value = digit;
                inputs[i].classList.add("filled");
            }

        });

        if(paste.length < 6){
            inputs[paste.length].focus();
        }else{
            inputs[5].focus();
        }

    });

    // Verify code (simulated - this prototype has no real email/SMS backend)

    form.addEventListener("submit", function (e) {

        e.preventDefault();

        let otp = "";

        inputs.forEach(input => {
            otp += input.value;
        });

        if(otp.length !== 6){

            verificationBox.classList.add("shake");

            inputs.forEach(input => {
                if(input.value === ""){
                    input.classList.add("error");
                }
            });

            setTimeout(() => {

                verificationBox.classList.remove("shake");

                inputs.forEach(input => {
                    input.classList.remove("error");
                });

            }, 400);

            showError(
                "Incomplete Code",
                "Please enter the complete 6-digit verification code."
            );

            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.classList.add("loading");

        verifyBtn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Verifying...
        `;

        setTimeout(() => {

            verifyBtn.classList.remove("loading");

            inputs.forEach(input => {
                input.classList.add("success");
            });

            verifyBtn.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                Code Verified
            `;

            setTimeout(() => {

                showSuccess(
                    "Verification Successful",
                    "Your identity has been successfully verified.<br><br>You may now create a new password.",
                    () => {
                        window.location.href = "owner-reset-password.html";
                    },
                    "Continue"
                );

                verifyBtn.disabled = false;
                verifyBtn.innerHTML = "Verify Code";

            }, 900);

        }, 1800);

    });

    // Enter key

    inputs.forEach(input => {

        input.addEventListener("keyup", function (e) {

            if(e.key === "Enter"){
                form.requestSubmit();
            }

        });

    });

    // Resend timer

    let countdown = 60;
    let timer;

    function startResendTimer(){

        resendBtn.disabled = true;
        resendBtn.textContent = `Resend in ${countdown}s`;

        timer = setInterval(() => {

            countdown--;
            resendBtn.textContent = `Resend in ${countdown}s`;

            if(countdown <= 0){
                clearInterval(timer);
                resendBtn.disabled = false;
                resendBtn.textContent = "Resend Code";
            }

        }, 1000);

    }

    startResendTimer();

    // Resend code

    resendBtn.addEventListener("click", function () {

        resendBtn.disabled = true;

        resendBtn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Sending...
        `;

        setTimeout(() => {

            showSuccess(
                "Verification Code Sent",
                "A new 6-digit verification code has been sent to your registered email address.",
                null,
                "OK"
            );

            countdown = 60;
            startResendTimer();

        }, 1600);

    });

});
