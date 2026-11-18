const path = require("path");

// Load the shared .env from blog-platform/ before any module reads process.env
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in blog-platform/.env");
  process.exit(1);
}

const db = require("./db");
const app = require("./src/app");

const PORT = process.env.BLOG_PORT || 5000;

// Check the database first, so a stopped MySQL gives a clear message instead of 500 errors later
db.query("SELECT 1")
  .then(() => {
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`Blog Server running at http://127.0.0.1:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(`Cannot connect to MariaDB: ${err.message}`);
    console.error("Start MySQL in XAMPP and run: npm run db:setup");
    process.exit(1);
  });
