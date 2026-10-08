const path = require("path");
const express = require("express");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json());                                          // parse JSON bodies
app.use(express.static(path.join(__dirname, "..", "public")));    // serve the HTML pages
app.use("/api", routes);                                          // all API routes live under /api
app.use(errorHandler);                                            // must be last

module.exports = app;
