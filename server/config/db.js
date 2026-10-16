
const { Pool } = require("pg");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing from the server/.env file"
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("connect", () => {
  console.log("Connected to PostgreSQL");
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err.message);
});

module.exports = pool;
