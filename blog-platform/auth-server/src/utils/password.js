const crypto = require("crypto");

// Stored as "salt:hash" so each user's random salt is kept with their hash
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(":");
  const savedHash = Buffer.from(hash, "hex");
  const attemptHash = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(savedHash, attemptHash);
}

module.exports = { hashPassword, verifyPassword };
