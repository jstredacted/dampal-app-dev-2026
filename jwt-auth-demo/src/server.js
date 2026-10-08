require("dotenv").config(); // must run before anything reads process.env

const app = require("./app");

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in .env");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, "127.0.0.1", () => console.log(`Server running at http://127.0.0.1:${PORT}`));
