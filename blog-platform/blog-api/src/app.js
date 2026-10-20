const path = require("path");
const express = require("express");
const postRoutes = require("./routes/post.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json());     // parse JSON request bodies
app.use(express.static(path.join(__dirname, "..", "public"))); // serve the HTML pages
app.use("/api", postRoutes); // all Blog API routes live under /api

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use(errorHandler);       // must be last

module.exports = app;
