
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CarFront, LogOut, RefreshCw, Star } from "lucide-react";

import MapBookingFields from "../components/MapBookingFields";
import "./dashboard.css";

const API = import.meta.env.VITE_API_URL;

export default function Dashboard() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("cabToken");

  const [user, setUser] = useState(() =>
    JSON.parse(sessionStorage.getItem("cabUser") || "null")
  );

  const [rides, setRides] = useState([]);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [distance, setDistance] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Rider review state
  const [reviewRatings, setReviewRatings] = useState({});
  const [reviewComments, setReviewComments] = useState({});
  const [submittingReview, setSubmittingReview] = useState(null);
  const [myReviews, setMyReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Driver rating state
  const [driverReviews, setDriverReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(null);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loadingDriverReviews, setLoadingDriverReviews] = useState(false);

  const logout = useCallback(() => {
    sessionStorage.removeItem("cabToken");
    sessionStorage.removeItem("cabUser");
    navigate("/login", { replace: true });
  }, [navigate]);

  // Shared API request helper
  const request = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      const data = await response.json();

      if (response.status === 401) {
        logout();
        throw new Error("Your session expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(data.message || "Request failed");
      }

      return data;
    },
    [token, logout]
  );

  const handleRouteChange = useCallback(
    ({ pickupLocation, dropoffLocation, distanceKm }) => {
      setPickup(pickupLocation);
      setDestination(dropoffLocation);
      setDistance(
        distanceKm === "" || distanceKm == null
          ? ""
          : String(distanceKm)
      );
    },
    []
  );

  // Load reviews submitted by the current rider
  const loadMyReviews = useCallback(async () => {
    setLoadingReviews(true);

    try {
      const data = await request("/api/reviews/mine");
      setMyReviews(data.reviews || []);
    } catch (err) {
      console.error("Could not load rider reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  }, [request]);

  // Load the driver's average rating and individual reviews
  const loadDriverReviews = useCallback(async () => {
    const driverId = user?.id || user?.userId;

    if (!driverId) {
      console.error("Driver ID is missing from the logged-in user.");
      return;
    }

    setLoadingDriverReviews(true);

    try {
      const data = await request(
        `/api/reviews/driver/${encodeURIComponent(driverId)}`
      );

      setAverageRating(data.averageRating ?? null);
      setTotalReviews(data.totalReviews ?? 0);
      setDriverReviews(data.reviews || []);
    } catch (err) {
      console.error("Could not load driver reviews:", err);
    } finally {
      setLoadingDriverReviews(false);
    }
  }, [request, user?.id, user?.userId]);

  // Load rider or driver ride history
  const loadRides = useCallback(async () => {
    setError("");

    try {
      const path =
        user.role === "rider"
          ? "/api/rides/mine"
          : "/api/rides/driver/mine";

      const data = await request(path);
      setRides(data.rides || []);
    } catch (err) {
      setError(err.message);
    }
  }, [request, user]);

  // Load available and assigned rides for drivers
  const loadDriverRides = useCallback(async () => {
    setError("");

    try {
      const [availableData, assignedData] = await Promise.all([
        request("/api/rides/available"),
        request("/api/rides/driver/mine"),
      ]);

      const ridesById = new Map();

      [...(availableData.rides || []), ...(assignedData.rides || [])]
        .forEach((ride) => ridesById.set(ride.id, ride));

      const allRides = Array.from(ridesById.values());

      allRides.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      setRides(allRides);
    } catch (err) {
      setError(err.message);
    }
  }, [request]);

  // Verify login session
  useEffect(() => {
    if (!token || !user) {
      navigate("/login", { replace: true });
      return;
    }

    request("/api/auth/me")
      .then((data) => {
        setUser(data.user);
        sessionStorage.setItem("cabUser", JSON.stringify(data.user));
      })
      .catch((err) => setError(err.message));
  }, [token, user?.id, request, navigate]);

  
  // Automatically refresh rides and reviews every 15 seconds.
  useEffect(() => {
    if (!user) return;

    const refreshDashboard = () => {
      if (user.role === "rider") {
        loadRides();
        loadMyReviews();
      } else {
        loadDriverRides();
        loadDriverReviews();
      }
    };

    const intervalId = setInterval(refreshDashboard, 15000);

    return () => clearInterval(intervalId);
  }, [
    user?.role,
    loadRides,
    loadDriverRides,
    loadMyReviews,
    loadDriverReviews,
  ]);


  async function bookRide(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    if (
      !pickup ||
      !destination ||
      !Number.isFinite(Number(distance)) ||
      Number(distance) <= 0
    ) {
      setError(
        "Please select both locations and wait for the driving route to be calculated."
      );
      setLoading(false);
      return;
    }

    try {
      const data = await request("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          pickup_location: pickup,
          dropoff_location: destination,
          distance_km: Number(distance),
        }),
      });

      setMessage(
        `Ride requested! Estimated fare: ₹${Number(
          data.ride.estimated_fare
        ).toFixed(2)}`
      );

      await loadRides();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function acceptRide(id) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await request(`/api/rides/${id}/accept`, {
        method: "PATCH",
      });

      setMessage("Ride accepted successfully.");
      await loadDriverRides();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, status) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await request(`/api/rides/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setMessage(`Ride marked as ${status.replace("_", " ")}.`);

      if (user.role === "driver") {
        await loadDriverRides();
      } else {
        await loadRides();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelRide(rideId) {
    if (!window.confirm("Are you sure you want to cancel this ride?")) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await request(`/api/rides/${rideId}/cancel`, {
        method: "PATCH",
      });

      setMessage(data.message || "Ride cancelled successfully.");
      await loadRides();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitReview(rideId) {
    const rating = reviewRatings[rideId] || 5;
    const comment = reviewComments[rideId] || "";

    setSubmittingReview(rideId);
    setError("");
    setMessage("");

    try {
      const data = await request(`/api/reviews/${rideId}`, {
        method: "POST",
        body: JSON.stringify({ rating, comment }),
      });

      if (data.review) {
        setMyReviews((previous) => [
          data.review,
          ...previous.filter((review) => review.ride_id !== rideId),
        ]);
      } else {
        await loadMyReviews();
      }

      setMessage(data.message || "Review submitted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingReview(null);
    }
  }

  if (!user) return null;

  const estimatedFare =
    distance !== "" && Number(distance) > 0
      ? 40 + Number(distance) * 12
      : null;

  return (
    <main className="dashboard-page">
      <header className="dash-header">
        <a className="dash-brand" href="/dashboard">
          <CarFront size={28} />
          RideOn
        </a>

        <div className="dash-user">
          <span>{user.full_name}</span>

          <button className="logout-btn" onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </header>

      <section className="dash-content">
        <div className="dash-heading">
          <div>
            <p className="eyebrow">
              {user.role === "rider" ? "RIDER PORTAL" : "DRIVER PORTAL"}
            </p>

            <h1>
              {user.role === "rider"
                ? "Where are we going?"
                : "Your rides, your road."}
            </h1>

            <p className="dash-subtitle">
              {user.role === "rider"
                ? "Book a ride and follow its progress."
                : "Accept available rides and manage your trips."}
            </p>
          </div>

          <button
            className="secondary-btn"
            onClick={() => {
              if (user.role === "rider") {
                loadRides();
                loadMyReviews();
              } else {
                loadDriverRides();
                loadDriverReviews();
              }
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice error">{error}</div>}

        {/* DRIVER RATINGS AND REVIEWS */}
        {user.role === "driver" && (
          <section className="dash-panel driver-rating-panel">
            <div className="panel-title">
              <h2>Your ratings and reviews</h2>

              <span className="ride-count">
                {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
              </span>
            </div>

            <div className="driver-rating-summary">
              <div className="driver-rating-score">
                <Star size={28} fill="currentColor" />
                <strong>
                  {averageRating == null
                    ? "—"
                    : Number(averageRating).toFixed(1)}
                </strong>
                <span>out of 5</span>
              </div>

              <div className="driver-rating-description">
                <h3>
                  {totalReviews === 0
                    ? "Your journey starts here"
                    : "Your driver rating"}
                </h3>

                <p>
                  {totalReviews === 0
                    ? "Complete rides and invite riders to share their experience."
                    : `Based on ${totalReviews} ${
                        totalReviews === 1 ? "review" : "reviews"
                      } from riders.`}
                </p>
              </div>
            </div>

            {loadingDriverReviews ? (
              <p className="reviews-loading">Loading your reviews...</p>
            ) : driverReviews.length === 0 ? (
              <div className="empty-state reviews-empty">
                <Star size={28} />
                <p>You haven't received any reviews yet.</p>
              </div>
            ) : (
              <div className="driver-review-list">
                {driverReviews.map((review) => (
                  <article className="driver-review-card" key={review.id}>
                    <div className="driver-review-header">
                      <div>
                        <strong>{review.rider_name || "Rider"}</strong>
                        <div
                          className="driver-review-stars"
                          aria-label={`${review.rating} out of 5 stars`}
                        >
                          {"★".repeat(Number(review.rating))}
                          {"☆".repeat(5 - Number(review.rating))}
                        </div>
                      </div>

                      <small>
                        {new Date(review.created_at).toLocaleDateString()}
                      </small>
                    </div>

                    <p>
                      {review.comment || "The rider left a rating without a comment."}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* RIDER BOOKING */}
        {user.role === "rider" && (
          <section className="dash-panel">
            <h2>Book a ride</h2>

            <form className="booking-form" onSubmit={bookRide}>
              <MapBookingFields onRouteChange={handleRouteChange} />

              <div className="fare-estimate">
                {estimatedFare !== null ? (
                  <>
                    <p>
                      <strong>Driving distance:</strong>{" "}
                      {Number(distance).toFixed(2)} km
                    </p>
                    <p>
                      <strong>Estimated fare:</strong>{" "}
                      ₹{estimatedFare.toFixed(2)}
                    </p>
                  </>
                ) : (
                  <p>Select pickup and destination to calculate your fare.</p>
                )}
              </div>

              <button
                className="primary-btn"
                disabled={
                  loading ||
                  !pickup ||
                  !destination ||
                  !distance ||
                  Number(distance) <= 0
                }
              >
                {loading ? "Please wait..." : "Request ride"}
              </button>
            </form>
          </section>
        )}

        {/* RIDE HISTORY AND DRIVER ACTIONS */}
        <section className="dash-panel">
          <div className="panel-title">
            <h2>
              {user.role === "rider"
                ? "My ride history"
                : "Available and assigned rides"}
            </h2>

            <span className="ride-count">{rides.length} rides</span>
          </div>

          {rides.length === 0 ? (
            <div className="empty-state">
              <CarFront size={32} />
              <p>No rides to display yet.</p>
            </div>
          ) : (
            <div className="ride-list">
              {rides.map((ride) => {
                const savedReview =
                  user.role === "rider"
                    ? myReviews.find(
                        (review) => review.ride_id === ride.id
                      )
                    : null;

                return (
                  <article className="ride-card" key={ride.id}>
                    <div className="ride-route">
                      <span className="route-dot pickup-dot" />

                      <div>
                        <small>Pickup</small>
                        <p>{ride.pickup_location}</p>
                      </div>

                      <span className="route-dot destination-dot" />

                      <div>
                        <small>Destination</small>
                        <p>{ride.dropoff_location}</p>
                      </div>
                    </div>

                    <div className="ride-meta">
                      <strong>
                        ₹{Number(ride.estimated_fare).toFixed(2)}
                      </strong>

                      <span className={`status status-${ride.status}`}>
                        {ride.status.replace("_", " ")}
                      </span>
                    </div>

                    {user.role === "driver" && (
                      <div className="ride-actions">
                        {ride.status === "requested" && (
                          <button
                            className="primary-btn"
                            disabled={loading}
                            onClick={() => acceptRide(ride.id)}
                          >
                            Accept ride
                          </button>
                        )}

                        {ride.status === "accepted" && (
                          <button
                            className="primary-btn"
                            disabled={loading}
                            onClick={() =>
                              updateStatus(ride.id, "in_progress")
                            }
                          >
                            Start ride
                          </button>
                        )}

                        {ride.status === "in_progress" && (
                          <button
                            className="primary-btn"
                            disabled={loading}
                            onClick={() =>
                              updateStatus(ride.id, "completed")
                            }
                          >
                            Complete ride
                          </button>
                        )}
                      </div>
                    )}

                    {user.role === "rider" &&
                      ["requested", "accepted"].includes(ride.status) && (
                        <div className="ride-actions">
                          <button
                            className="cancel-ride-btn"
                            disabled={loading}
                            onClick={() => cancelRide(ride.id)}
                          >
                            Cancel ride
                          </button>
                        </div>
                      )}

                    {/* SAVED RIDER REVIEW */}
                    {user.role === "rider" &&
                      ride.status === "completed" &&
                      savedReview && (
                        <div className="saved-review">
                          <h3>Your review</h3>

                          <div className="saved-review-stars">
                            {"★".repeat(Number(savedReview.rating))}
                            {"☆".repeat(5 - Number(savedReview.rating))}
                          </div>

                          {savedReview.comment && <p>{savedReview.comment}</p>}

                          <small>
                            Submitted{" "}
                            {new Date(
                              savedReview.created_at
                            ).toLocaleDateString()}
                          </small>
                        </div>
                      )}

                    {/* REVIEW FORM FOR COMPLETED RIDES */}
                    {user.role === "rider" &&
                      ride.status === "completed" &&
                      !savedReview &&
                      !loadingReviews && (
                        <div className="review-form">
                          <h3>Rate your ride</h3>

                          <div className="review-stars">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const selectedRating =
                                reviewRatings[ride.id] || 5;

                              return (
                                <button
                                  key={star}
                                  type="button"
                                  className={
                                    star <= selectedRating
                                      ? "review-star selected"
                                      : "review-star"
                                  }
                                  aria-label={`${star} star${
                                    star > 1 ? "s" : ""
                                  }`}
                                  onClick={() =>
                                    setReviewRatings((previous) => ({
                                      ...previous,
                                      [ride.id]: star,
                                    }))
                                  }
                                >
                                  ★
                                </button>
                              );
                            })}
                          </div>

                          <textarea
                            className="review-comment"
                            placeholder="Share your experience (optional)"
                            maxLength={500}
                            value={reviewComments[ride.id] || ""}
                            onChange={(e) =>
                              setReviewComments((previous) => ({
                                ...previous,
                                [ride.id]: e.target.value,
                              }))
                            }
                          />

                          <button
                            type="button"
                            className="primary-btn"
                            disabled={submittingReview === ride.id}
                            onClick={() => submitReview(ride.id)}
                          >
                            {submittingReview === ride.id
                              ? "Submitting..."
                              : "Submit review"}
                          </button>
                        </div>
                      )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
