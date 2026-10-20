const jwt = require("jsonwebtoken");

// Verifies the access token with the shared JWT_SECRET. Never calls the Auth Server.
module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization; // expected: "Bearer <token>"
  const parts = header && header.split(" ");
  const token = parts && parts.length === 2 && parts[0] === "Bearer" && parts[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET); // checks signature + expiry
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (payload.type === "refresh") {
    return res.status(401).json({ error: "Refresh tokens cannot be used here" });
  }

  req.user = { id: payload.id, username: payload.username, role: payload.role };
  next();
};
