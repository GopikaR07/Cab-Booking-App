
const pool = require("../config/db");

// Create a ride request (riders only)
async function createRide(req, res) {
  try {
    const { pickup_location, dropoff_location, distance_km } = req.body;

    if (
      typeof pickup_location !== "string" ||
      typeof dropoff_location !== "string" ||
      !pickup_location.trim() ||
      !dropoff_location.trim()
    ) {
      return res.status(400).json({
        message: "Pickup and destination are required",
      });
    }

    const distance = Number(distance_km);

    if (!Number.isFinite(distance) || distance <= 0 || distance > 500) {
      return res.status(400).json({
        message: "Distance must be between 0 and 500 km",
      });
    }

    // Demo fare: base fare + per-kilometre charge.
    // Replace with route-based distance calculation when maps are added.
    const estimatedFare = Number((40 + distance * 12).toFixed(2));

    const result = await pool.query(
      `INSERT INTO rides
       (rider_id, pickup_location, dropoff_location, estimated_fare)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        req.user.userId,
        pickup_location.trim(),
        dropoff_location.trim(),
        estimatedFare,
      ]
    );

    return res.status(201).json({
      message: "Ride requested successfully",
      ride: result.rows[0],
    });
  } catch (error) {
    console.error("Create ride error:", error.message);
    return res.status(500).json({ message: "Could not create ride" });
  }
}

// Rider sees their own rides
async function getMyRides(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM rides
       WHERE rider_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    return res.json({ rides: result.rows });
  } catch (error) {
    console.error("Get rider rides error:", error.message);
    return res.status(500).json({ message: "Could not fetch rides" });
  }
}

// Driver sees available requests
async function getAvailableRides(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, pickup_location, dropoff_location,
              estimated_fare, status, created_at
       FROM rides
       WHERE status = 'requested'
       ORDER BY created_at ASC`
    );

    return res.json({ rides: result.rows });
  } catch (error) {
    console.error("Get available rides error:", error.message);
    return res.status(500).json({ message: "Could not fetch requests" });
  }
}

// Atomically accept a request so two drivers cannot claim it
async function acceptRide(req, res) {
  try {
    const result = await pool.query(
      `UPDATE rides
       SET driver_id = $1, status = 'accepted'
       WHERE id = $2 AND status = 'requested'
       RETURNING *`,
      [req.user.userId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        message: "Ride is unavailable or has already been accepted",
      });
    }

    return res.json({
      message: "Ride accepted successfully",
      ride: result.rows[0],
    });
  } catch (error) {
    console.error("Accept ride error:", error.message);
    return res.status(500).json({ message: "Could not accept ride" });
  }
}

// Assigned driver advances the ride
async function updateRideStatus(req, res) {
  try {
    const { status } = req.body;

    const allowedTransitions = {
      accepted: "in_progress",
      in_progress: "completed",
    };

    if (!allowedTransitions[status]) {
      return res.status(400).json({
        message: "Status must be in_progress or completed",
      });
    }

    const previousStatus = Object.keys(allowedTransitions).find(
      (key) => allowedTransitions[key] === status
    );

    const result = await pool.query(
      `UPDATE rides
       SET status = $1
       WHERE id = $2
         AND driver_id = $3
         AND status = $4
       RETURNING *`,
      [status, req.params.id, req.user.userId, previousStatus]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        message: "Ride not found, not assigned to you, or invalid transition",
      });
    }

    return res.json({
      message: "Ride status updated",
      ride: result.rows[0],
    });
  } catch (error) {
    console.error("Update ride status error:", error.message);
    return res.status(500).json({ message: "Could not update ride" });
  }
}


async function getMyDriverRides(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM rides
       WHERE driver_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    res.json({ rides: result.rows });
  } catch (error) {
    console.error("Driver rides error:", error.message);
    res.status(500).json({ message: "Could not fetch driver rides" });
  }
}


module.exports = {
  createRide,
  getMyRides,
  getAvailableRides,
  acceptRide,
  updateRideStatus,
  getMyDriverRides,
};
