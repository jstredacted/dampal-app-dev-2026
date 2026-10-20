const path = require("path");

// Load the shared .env from blog-platform/ before any module reads process.env
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in blog-platform/.env");
  process.exit(1);
}

const app = require("./src/app");

const PORT = process.env.BLOG_PORT || 5000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Blog API running at http://127.0.0.1:${PORT}`);
});
