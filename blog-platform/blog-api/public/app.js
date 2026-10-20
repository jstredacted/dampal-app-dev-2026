// Shared by every page: the Auth Server address, token helpers, and the navigation bar.
const AUTH_URL = "http://127.0.0.1:4000"; // the Auth Server is a separate server

function show(text, ok = false) {
  const message = document.getElementById("message");
  message.textContent = text;
  message.className = ok ? "ok" : "";
}

// Reads { id, username, role } from the access token's middle part (the payload).
// This is only for showing the right links and buttons; the Blog API still checks every request.
function currentUser() {
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function canWrite(user) {
  return !!user && (user.role === "author" || user.role === "admin");
}

function clearTokensAndLogin() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.location.href = "/login.html";
}

// When the 15-minute access token has expired, trade the refresh token for a new one
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;
  const res = await fetch(`${AUTH_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  localStorage.setItem("accessToken", (await res.json()).accessToken);
  return true;
}

// fetch() for protected Blog API routes: adds the Bearer token, refreshes once on 401
async function authFetch(url, options = {}, retried = false) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    },
  });
  if (res.status === 401 && !retried) {
    if (await refreshAccessToken()) return authFetch(url, options, true);
    clearTokensAndLogin();
  }
  return res;
}

async function logout() {
  try {
    await fetch(`${AUTH_URL}/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: localStorage.getItem("refreshToken") }),
    });
  } catch {
    // Still clear the tokens in this browser even if the Auth Server is down
  }
  clearTokensAndLogin();
}

// Builds the navigation links for whoever is logged in (or nobody)
function renderNav(activePage) {
  const user = currentUser();
  const nav = document.querySelector("nav");
  const links = [["blogs", "/index.html", "Blogs"]];
  if (user) links.push(["mine", "/index.html?mine=1", "My Blogs"]);
  links.push(["about", "/about.html", "About"]);
  if (canWrite(user)) links.push(["create", "/create.html", "New Blog"]);
  if (!user) links.push(["login", "/login.html", "Log In"]);

  nav.textContent = "";
  for (const [page, href, text] of links) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    if (page === activePage) a.className = "active";
    nav.appendChild(a);
  }
  if (user) {
    const out = document.createElement("button");
    out.type = "button";
    out.id = "logout";
    out.textContent = "Log Out";
    out.addEventListener("click", logout);
    nav.appendChild(out);
    document.getElementById("signed-in").textContent = `Signed in as ${user.username} (${user.role})`;
  }
}
