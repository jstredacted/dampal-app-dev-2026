const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization; // expected: "Bearer <token>"
  const parts = header && header.split(" ");
  const token = parts && parts[0] === "Bearer" && parts.length === 2 && parts[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // checks signature + expiry
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
