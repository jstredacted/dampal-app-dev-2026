const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

function signToken(user) {
  return jwt.sign(
    { userId: user.id },                       // payload: keep it small, no secrets
    process.env.JWT_SECRET,                    // the server-only secret
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
}

exports.register = async (req, res, next) => {
  try {
    const { username, email, bio, password } = req.body || {};

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({ error: "Username, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const normalizedEmail = email.trim();
    if (User.findByEmail(normalizedEmail)) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10); // never store plain passwords
    if (User.findByEmail(normalizedEmail)) {
      return res.status(409).json({ error: "Email is already registered" });
    }
    User.create({
      username: username.trim(),
      email: normalizedEmail,
      bio: typeof bio === "string" ? bio.trim() : "",
      passwordHash,
    });

    res.status(201).json({ message: "Account created. You can log in now." });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const user = User.findByEmail(email.trim());

    // Same message for both cases so attackers can't tell which emails exist
    const valid = user && (await bcrypt.compare(password || "", user.passwordHash));
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({ token: signToken(user) });
  } catch (err) {
    next(err);
  }
};
