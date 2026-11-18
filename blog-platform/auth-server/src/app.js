const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Limits how many auth requests one address can make, to slow down password guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: Number(process.env.AUTH_RATE_LIMIT || 100),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.use(helmet());         // secure HTTP response headers
app.use(express.json());   // parse JSON request bodies
app.use(cookieParser());   // read the httpOnly refreshToken cookie into req.cookies
app.use(authLimiter);
app.use("/", authRoutes);  // POST /register, /login, /refresh, /logout

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use(errorHandler);     // must be last

module.exports = app;
