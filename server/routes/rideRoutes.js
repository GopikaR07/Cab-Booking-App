
const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");

const {
  createRide,
  getMyRides,
  getAvailableRides,
  acceptRide,
  updateRideStatus,
  getMyDriverRides,
} = require("../controllers/rideController");

// Require a valid JWT for all ride endpoints
router.use(verifyToken);

// Rider endpoints
router.post("/", (req, res, next) => {
  if (req.user.role !== "rider") {
    return res.status(403).json({ message: "Riders only" });
  }
  next();
}, createRide);

router.get("/mine", (req, res, next) => {
  if (req.user.role !== "rider") {
    return res.status(403).json({ message: "Riders only" });
  }
  next();
}, getMyRides);

// Driver endpoints
router.get("/available", (req, res, next) => {
  if (req.user.role !== "driver") {
    return res.status(403).json({ message: "Drivers only" });
  }
  next();
}, getAvailableRides);

router.patch("/:id/accept", (req, res, next) => {
  if (req.user.role !== "driver") {
    return res.status(403).json({ message: "Drivers only" });
  }
  next();
}, acceptRide);

router.patch("/:id/status", (req, res, next) => {
  if (req.user.role !== "driver") {
    return res.status(403).json({ message: "Drivers only" });
  }
  next();
}, updateRideStatus);

router.get("/driver/mine", (req, res, next) => {
  if (req.user.role !== "driver") {
    return res.status(403).json({ message: "Drivers only" });
  }
  next();
}, getMyDriverRides);

module.exports = router;
