
const pool = require("../config/db");

// Submit a review for a completed ride
async function createReview(req, res) {
  try {
    const { rideId } = req.params;
    const { rating, comment } = req.body;
    const riderId = req.user.userId;

    const numericRating = Number(rating);

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        message: "Rating must be a whole number between 1 and 5.",
      });
    }

    const reviewComment =
      typeof comment === "string" ? comment.trim() : "";

    if (reviewComment.length > 500) {
      return res.status(400).json({
        message: "Comment cannot exceed 500 characters.",
      });
    }

    const rideResult = await pool.query(
      `SELECT id, rider_id, driver_id, status
       FROM rides
       WHERE id = $1 AND rider_id = $2`,
      [rideId, riderId]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({
        message: "Ride not found or it does not belong to you.",
      });
    }

    const ride = rideResult.rows[0];

    if (ride.status !== "completed") {
      return res.status(400).json({
        message: "You can review a ride only after it is completed.",
      });
    }

    if (!ride.driver_id) {
      return res.status(400).json({
        message: "This ride has no assigned driver to review.",
      });
    }

    const result = await pool.query(
      `INSERT INTO ride_reviews
         (ride_id, rider_id, driver_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, ride_id, rider_id, driver_id,
                 rating, comment, created_at`,
      [
        ride.id,
        riderId,
        ride.driver_id,
        numericRating,
        reviewComment || null,
      ]
    );

    return res.status(201).json({
      message: "Review submitted successfully.",
      review: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "You have already reviewed this ride.",
      });
    }

    console.error("Create review error:", error.message);

    return res.status(500).json({
      message: "Could not submit review.",
    });
  }
}

// Get reviews submitted by the currently logged-in rider
async function getMyReviews(req, res) {
  try {
    const riderId = req.user.userId;

    const result = await pool.query(
      `SELECT id, ride_id, rating, comment, created_at
       FROM ride_reviews
       WHERE rider_id = $1
       ORDER BY created_at DESC`,
      [riderId]
    );

    return res.status(200).json({
      reviews: result.rows,
    });
  } catch (error) {
    console.error("Get my reviews error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve your reviews.",
    });
  }
}

// Get all reviews and average rating for a driver
async function getDriverReviews(req, res) {
  try {
    const { driverId } = req.params;

    const result = await pool.query(
      `SELECT rr.id, rr.ride_id, rr.rating, rr.comment,
              rr.created_at, u.full_name AS rider_name
       FROM ride_reviews rr
       JOIN users u ON u.id = rr.rider_id
       WHERE rr.driver_id = $1
       ORDER BY rr.created_at DESC`,
      [driverId]
    );

    const ratings = result.rows.map((review) => review.rating);

    const averageRating =
      ratings.length > 0
        ? Number(
            (
              ratings.reduce((sum, value) => sum + value, 0) /
              ratings.length
            ).toFixed(1)
          )
        : null;

    return res.status(200).json({
      averageRating,
      totalReviews: result.rows.length,
      reviews: result.rows,
    });
  } catch (error) {
    console.error("Get driver reviews error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve driver reviews.",
    });
  }
}

module.exports = {
  createReview,
  getMyReviews,
  getDriverReviews,
};
