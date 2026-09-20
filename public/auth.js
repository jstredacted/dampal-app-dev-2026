const form = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const submitButton = document.getElementById("submit-button");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (submitButton.disabled) {
    return;
  }

  const body = {
    username: usernameInput.value,
    password: passwordInput.value
  };

  if (emailInput) {
    body.email = emailInput.value;
  }

  submitButton.disabled = true;
  message.textContent = "Submitting...";

  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();

    if (!response.ok) {
      message.textContent = `Error ${response.status}: ${data.message}`;
      return;
    }

    // The API keeps its 201/200 status; the browser handles navigation.
    window.location.href = emailInput ? "home.html#signup" : "home.html#login";
  } catch (error) {
    message.textContent = "Could not reach the server. Make sure it is running and try again.";
  } finally {
    submitButton.disabled = false;
  }
});
