
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CarFront, LogOut, MapPin, RefreshCw } from "lucide-react";
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
  const [distance, setDistance] = useState("5");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const logout = useCallback(() => {
    sessionStorage.removeItem("cabToken");
    sessionStorage.removeItem("cabUser");
    navigate("/login", { replace: true });
  }, [navigate]);

  const request = useCallback(async (path, options = {}) => {
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
  }, [token, logout]);

  const loadRides = useCallback(async () => {
    setError("");

    try {
      const path = user.role === "rider"
        ? "/api/rides/mine"
        : "/api/rides/driver/mine";

      const data = await request(path);
      setRides(data.rides || []);
    } catch (err) {
      setError(err.message);
    }
  }, [request, user]);

  const loadAvailableRides = useCallback(async () => {
    setError("");

    try {
      const data = await request("/api/rides/available");
      setRides(data.rides || []);
    } catch (err) {
      setError(err.message);
    }
  }, [request]);

  useEffect(() => {
    if (!token || !user) {
      navigate("/login", { replace: true });
      return;
    }

    // Verify the token with the backend, not just browser storage.
    request("/api/auth/me")
      .then(data => {
        setUser(data.user);
        sessionStorage.setItem("cabUser", JSON.stringify(data.user));
      })
      .catch(err => setError(err.message));
  }, [token, request, navigate]);

  useEffect(() => {
    if (!user) return;

    if (user.role === "rider") {
      loadRides();
    } else {
      loadAvailableRides();
    }
  }, [user?.role, loadRides, loadAvailableRides]);

  async function bookRide(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

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
        `Ride requested! Estimated fare: ₹${data.ride.estimated_fare}`
      );
      setPickup("");
      setDestination("");
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
      await request(`/api/rides/${id}/accept`, { method: "PATCH" });
      setMessage("Ride accepted successfully.");
      await loadAvailableRides();
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
      await loadRides();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <main className="dashboard-page">
      <header className="dash-header">
        <a className="dash-brand" href="/dashboard">
          <CarFront size={28} /> RideOn
        </a>
        <div className="dash-user">
          <span>{user.full_name}</span>
          <button className="logout-btn" onClick={logout}>
            <LogOut size={17} /> Logout
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
            onClick={user.role === "rider"
              ? loadRides
              : loadAvailableRides}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice error">{error}</div>}

        {user.role === "rider" && (
          <section className="dash-panel">
            <h2>Book a ride</h2>
            <form className="booking-form" onSubmit={bookRide}>
              <label>
                <MapPin size={17} /> Pickup location
                <input
                  value={pickup}
                  onChange={e => setPickup(e.target.value)}
                  placeholder="Enter pickup location"
                  maxLength={250}
                  required
                />
              </label>

              <label>
                <MapPin size={17} /> Destination
                <input
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="Where do you want to go?"
                  maxLength={250}
                  required
                />
              </label>

              <label>
                Estimated distance (km)
                <input
                  type="number"
                  min="0.1"
                  max="500"
                  step="0.1"
                  value={distance}
                  onChange={e => setDistance(e.target.value)}
                  required
                />
              </label>

              <p className="fare-estimate">
                Estimated fare: ₹
                {(40 + Math.max(0, Number(distance) || 0) * 12).toFixed(2)}
              </p>

              <button className="primary-btn" disabled={loading}>
                {loading ? "Please wait..." : "Request ride"}
              </button>
            </form>
          </section>
        )}

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
              {rides.map(ride => (
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
                    <strong>₹{Number(ride.estimated_fare).toFixed(2)}</strong>
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
                          onClick={() => updateStatus(ride.id, "in_progress")}
                        >
                          Start ride
                        </button>
                      )}
                      {ride.status === "in_progress" && (
                        <button
                          className="primary-btn"
                          disabled={loading}
                          onClick={() => updateStatus(ride.id, "completed")}
                        >
                          Complete ride
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
