const pool = require("./config/db");
const verifyToken = require("./middleware/authMiddleware");
const authRoutes = require("./routes/authRoutes");
const rideRoutes = require("./routes/rideRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/reviews", reviewRoutes);

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "Cab Booking App API is running!",
  });
});

// Health-check route
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend is healthy",
  });
});


app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.json({
      status: "OK",
      message: "Database connected successfully",
      databaseTime: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);

    res.status(500).json({
      status: "ERROR",
      message: "Database connection failed",
    });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


app.get("/api/auth/me", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role
       FROM users
       WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Profile error:", error.message);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});