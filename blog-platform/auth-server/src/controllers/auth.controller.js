const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { hashPassword, verifyPassword } = require("../utils/password");

const ROLES = ["reader", "author", "admin"];

function isMissing(value) {
  return typeof value !== "string" || value.trim() === "";
}

// Access token: { id, username, role }, used on the Blog API for 15 minutes
function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

// Refresh token: same secret, marked type "refresh" so the Blog API rejects it.
// jwtid makes every login's token unique, even two logins in the same second.
function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: "7d", jwtid: crypto.randomUUID() }
  );
}

exports.register = (req, res, next) => {
  try {
    const { username, password, role } = req.body || {};

    if (isMissing(username) || isMissing(password) || isMissing(role)) {
      return res.status(400).json({ error: "Username, password and role are required" });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: "Role must be reader, author or admin" });
    }
    if (User.findByUsername(username.trim())) {
      return res.status(409).json({ error: "Username is already taken" });
    }

    const user = User.create({
      username: username.trim(),
      hashed_password: hashPassword(password), // never store plain passwords
      role,
    });

    res.status(201).json({
      message: "Account created. You can log in now.",
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (isMissing(username) || isMissing(password)) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const user = User.findByUsername(username.trim());
    // Same message for both cases so nobody can tell which usernames exist
    if (!user || !verifyPassword(password, user.hashed_password)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const refreshToken = signRefreshToken(user);
    User.update(user.id, { refresh_token: refreshToken, revoked_at: null });

    res.status(200).json({
      accessToken: signAccessToken(user),
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

exports.refresh = (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (isMissing(refreshToken)) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET); // signature + expiry
    } catch {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    if (payload.type !== "refresh") {
      return res.status(401).json({ error: "Not a refresh token" });
    }

    const user = User.findById(payload.id);
    if (!user || user.refresh_token !== refreshToken) {
      return res.status(401).json({ error: "Refresh token has been revoked" });
    }

    res.status(200).json({ accessToken: signAccessToken(user) });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (isMissing(refreshToken)) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const user = User.findByRefreshToken(refreshToken);
    if (user) {
      User.update(user.id, { refresh_token: null, revoked_at: new Date().toISOString() });
    }

    // Always 200, so the response does not reveal whether the token was stored
    res.status(200).json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
};
