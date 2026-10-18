
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const register = async (req, res) => {
  try {
    const { full_name, email, password, phone, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        message: "Name, email, password and role are required",
      });
    }

    if (!["rider", "driver"].includes(role)) {
      return res.status(400).json({
        message: "Role must be rider or driver",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, phone, role, created_at`,
      [
        full_name.trim(),
        normalizedEmail,
        password_hash,
        phone || null,
        role,
      ]
    );

    return res.status(201).json({
      message: "Registration successful",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    console.error("Registration error:", error.message);
    return res.status(500).json({
      message: "Registration failed",
    });
  }
};


const login = async (req, res) => {
  const startedAt = Date.now();

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    console.log("[LOGIN] Request received");

    const dbStartedAt = Date.now();

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    console.log(
      `[LOGIN] Database query took ${Date.now() - dbStartedAt} ms`
    );

    const user = result.rows[0];

    if (!user) {
      console.log("[LOGIN] User not found");

      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordStartedAt = Date.now();

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    console.log(
      `[LOGIN] Password comparison took ${Date.now() - passwordStartedAt} ms`
    );

    if (!passwordMatches) {
      console.log("[LOGIN] Password did not match");

      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    console.log(
      `[LOGIN] Completed in ${Date.now() - startedAt} ms`
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(
      `[LOGIN] Failed after ${Date.now() - startedAt} ms:`,
      error.message
    );

    return res.status(500).json({
      message: "Login failed",
    });
  }
};


module.exports = { register, login };
