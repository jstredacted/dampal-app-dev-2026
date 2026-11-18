const express = require("express");
const helmet = require("helmet");
const postRoutes = require("./routes/post.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(helmet());           // secure HTTP response headers
app.use(express.json());     // parse JSON request bodies
app.use("/api", postRoutes); // all Blog Server routes live under /api

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use(errorHandler);       // must be last

module.exports = app;
