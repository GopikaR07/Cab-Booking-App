
const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");

const {
  createReview,
  getMyReviews,
  getDriverReviews,
} = require("../controllers/reviewController");

router.use(verifyToken);

// Get reviews belonging to the logged-in rider
router.get("/mine", getMyReviews);

// Get reviews for a particular driver
router.get("/driver/:driverId", getDriverReviews);

// Submit a review (riders only)
router.post("/:rideId", (req, res, next) => {
  if (req.user.role !== "rider") {
    return res.status(403).json({
      message: "Riders only",
    });
  }

  next();
}, createReview);

module.exports = router;
