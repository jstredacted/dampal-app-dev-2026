// One shared pool of MariaDB connections (XAMPP). Controllers call db.query(sql, values).
const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "blog_platform",
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = db;
