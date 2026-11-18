// Creates the database, tables and roles from schema.sql. Run with: npm run db:setup
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function main() {
  const dbName = process.env.DB_NAME || "blog_platform";
  // schema.sql is written for blog_platform; the same file can create another database name
  const sql = fs
    .readFileSync(path.join(__dirname, "schema.sql"), "utf8")
    .replaceAll("blog_platform", dbName);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true, // schema.sql has several statements
  });
  await connection.query(sql);
  await connection.end();
  console.log(`Database "${dbName}" is ready (tables: roles, users, refresh_tokens, posts).`);
}

main().catch((err) => {
  console.error(`Database setup failed: ${err.message}`);
  console.error("Is MySQL running in the XAMPP control panel?");
  process.exit(1);
});
