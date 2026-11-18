const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../../db");
const { hashPassword, verifyPassword } = require("../utils/password");

const ROLES = ["reader", "author", "admin"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REFRESH_COOKIE = "refreshToken";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isMissing(value) {
  return typeof value !== "string" || value.trim() === "";
}

// Only a SHA-256 hash of the refresh token is saved (token_hash CHAR(64)),
// so a leaked database does not leak usable tokens
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Access token: { id, username, role }, used on the Blog Server for 15 minutes
function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

// Refresh token: same secret, marked type "refresh" so the Blog Server rejects it.
// jwtid makes every login's token unique, even two logins in the same second.
function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: "7d", jwtid: crypto.randomUUID() }
  );
}

// Postman sends the refresh token in the body; the React app sends it as an httpOnly cookie
function readRefreshToken(req) {
  const fromBody = req.body && req.body.refreshToken;
  if (fromBody !== undefined) return fromBody;
  return req.cookies && req.cookies[REFRESH_COOKIE];
}

exports.register = async (req, res, next) => {
  try {
    const { email, username, password, role } = req.body || {};

    if (isMissing(email) || isMissing(username) || isMissing(password) || isMissing(role)) {
      return res.status(400).json({ error: "Email, username, password and role are required" });
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({ error: "Email must be a valid email address" });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: "Role must be reader, author or admin" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    const [taken] = await db.query(
      "SELECT username, email FROM users WHERE username = ? OR email = ?",
      [cleanUsername, cleanEmail]
    );
    if (taken.some((u) => u.username === cleanUsername)) {
      return res.status(409).json({ error: "Username is already taken" });
    }
    if (taken.length > 0) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    const [roleRows] = await db.query("SELECT id FROM roles WHERE role = ?", [role]);
    if (roleRows.length === 0) {
      return res.status(500).json({ error: "Roles are missing. Run npm run db:setup" });
    }

    const [result] = await db.query(
      "INSERT INTO users (email, username, password_hash, role_id) VALUES (?, ?, ?, ?)",
      [cleanEmail, cleanUsername, hashPassword(password), roleRows[0].id] // never store plain passwords
    );

    res.status(201).json({
      message: "Account created. You can log in now.",
      user: { id: result.insertId, email: cleanEmail, username: cleanUsername, role },
    });
  } catch (err) {
    // Two sign-ups at the same moment: the UNIQUE constraint catches what the SELECT missed
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username or email is already taken" });
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (isMissing(username) || isMissing(password)) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const [rows] = await db.query(
      `SELECT users.id, users.username, users.password_hash, users.is_active, roles.role
       FROM users JOIN roles ON roles.id = users.role_id
       WHERE users.username = ?`,
      [username.trim()]
    );
    const user = rows[0];

    // Same message for every case so nobody can tell which usernames exist
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const refreshToken = signRefreshToken(user);
    await db.query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
      [user.id, hashToken(refreshToken)]
    );

    // httpOnly: page JavaScript cannot read this cookie, which protects it from XSS
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: SEVEN_DAYS_MS,
    });

    res.status(200).json({
      accessToken: signAccessToken(user),
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = readRefreshToken(req);
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

    const [rows] = await db.query(
      `SELECT users.id, users.username, roles.role
       FROM refresh_tokens
       JOIN users ON users.id = refresh_tokens.user_id
       JOIN roles ON roles.id = users.role_id
       WHERE refresh_tokens.token_hash = ?
         AND refresh_tokens.user_id = ?
         AND refresh_tokens.revoked_at IS NULL
         AND refresh_tokens.expires_at > NOW()
         AND users.is_active = 1`,
      [hashToken(refreshToken), payload.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Refresh token has been revoked" });
    }

    res.status(200).json({ accessToken: signAccessToken(rows[0]) });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const refreshToken = readRefreshToken(req);
    if (isMissing(refreshToken)) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    await db.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
      [hashToken(refreshToken)]
    );
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: "strict" });

    // Always 200, so the response does not reveal whether the token was stored
    res.status(200).json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
};
