const express = require("express");
const authRoutes = require("./routes/auth.routes");
const cors = require("./middleware/cors");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors);             // let the frontend pages on the Blog API call these routes
app.use(express.json());   // parse JSON request bodies
app.use("/", authRoutes);  // POST /register, /login, /refresh, /logout

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use(errorHandler);     // must be last

module.exports = app;
