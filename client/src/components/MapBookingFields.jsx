
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [11.0168, 76.9558];

function FitRoute({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 2) {
      map.fitBounds(points, { padding: [35, 35] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [points, map]);

  return null;
}

export default function MapBookingFields({ onRouteChange }) {
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [route, setRoute] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fareRef = useRef(null);

  async function searchLocation(query) {
    if (!query.trim()) {
      throw new Error("Enter a location first.");
    }

    const url = new URL(
      "https://nominatim.openstreetmap.org/search"
    );

    url.search = new URLSearchParams({
      format: "jsonv2",
      q: query.trim(),
      limit: "1",
    }).toString();

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Location search failed. Please try again.");
    }

    const results = await response.json();

    if (!results.length) {
      throw new Error("Location not found. Try a more specific address.");
    }

    return {
      name: results[0].display_name,
      lat: Number(results[0].lat),
      lon: Number(results[0].lon),
    };
  }

  async function findPickup() {
    setLoading(true);
    setError("");
    setDistanceKm(null);
    setRoute([]);

    try {
      const location = await searchLocation(pickupQuery);
      setPickup(location);

      onRouteChange?.({
        pickupLocation: location.name,
        dropoffLocation: dropoff?.name || "",
        distanceKm: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function findDropoff() {
    setLoading(true);
    setError("");
    setDistanceKm(null);
    setRoute([]);

    try {
      const location = await searchLocation(dropoffQuery);
      setDropoff(location);

      onRouteChange?.({
        pickupLocation: pickup?.name || "",
        dropoffLocation: location.name,
        distanceKm: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function calculateRoute() {
      if (!pickup || !dropoff) return;

      setLoading(true);
      setError("");
      setDistanceKm(null);
      setRoute([]);

      try {
        const url =
          "https://router.project-osrm.org/route/v1/driving/" +
          `${pickup.lon},${pickup.lat};${dropoff.lon},${dropoff.lat}` +
          "?overview=full&geometries=geojson";

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Could not calculate the driving route.");
        }

        const data = await response.json();

        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No driving route found between these locations.");
        }

        const result = data.routes[0];
        const km = Number((result.distance / 1000).toFixed(2));

        const coordinates = result.geometry.coordinates.map(
          ([longitude, latitude]) => [latitude, longitude]
        );

        if (cancelled) return;

        setDistanceKm(km);
        setRoute(coordinates);

        onRouteChange?.({
          pickupLocation: pickup.name,
          dropoffLocation: dropoff.name,
          distanceKm: km,
        });

        // Show the calculated fare once the route is ready.
        window.setTimeout(() => {
          fareRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 150);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);

          onRouteChange?.({
            pickupLocation: pickup.name,
            dropoffLocation: dropoff.name,
            distanceKm: "",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    calculateRoute();

    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, onRouteChange]);

  const points = [
    ...(pickup ? [[pickup.lat, pickup.lon]] : []),
    ...(dropoff ? [[dropoff.lat, dropoff.lon]] : []),
  ];

  const estimatedFare =
    distanceKm !== null ? 40 + distanceKm * 12 : null;

  return (
    <section className="map-booking-layout">
      <div className="booking-map-column">
        <div className="map-heading">
          <h3>Your route</h3>
          <p>Explore the area and view your driving route.</p>
        </div>

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          scrollWheelZoom
          className="cab-route-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitRoute points={points} />

          {pickup && (
            <CircleMarker
              center={[pickup.lat, pickup.lon]}
              radius={8}
              pathOptions={{
                color: "#15803d",
                fillColor: "#22c55e",
                fillOpacity: 1,
              }}
            >
              <Popup>Pickup location</Popup>
            </CircleMarker>
          )}

          {dropoff && (
            <CircleMarker
              center={[dropoff.lat, dropoff.lon]}
              radius={8}
              pathOptions={{
                color: "#b91c1c",
                fillColor: "#ef4444",
                fillOpacity: 1,
              }}
            >
              <Popup>Drop-off location</Popup>
            </CircleMarker>
          )}

          {route.length > 0 && (
            <Polyline
              positions={route}
              pathOptions={{ color: "#6558d3", weight: 5 }}
            />
          )}
        </MapContainer>

        <p className="map-attribution-note">
          Map data © OpenStreetMap contributors
        </p>
      </div>

      <div className="booking-controls-column">
        <div className="map-heading">
          <h3>Book your ride</h3>
          <p>Where should your driver pick you up?</p>
        </div>

        <div className="map-location-field">
          <label htmlFor="pickup-location">Pickup location</label>

          <div className="map-search-row">
            <input
              id="pickup-location"
              value={pickupQuery}
              onChange={(e) => setPickupQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  findPickup();
                }
              }}
              placeholder="Enter pickup or landmark"
            />

            <button
              type="button"
              onClick={findPickup}
              disabled={loading}
            >
              Find
            </button>
          </div>

          {pickup && (
            <p className="map-selected-location">
              {pickup.name}
            </p>
          )}
        </div>

        <div className="map-location-field">
          <label htmlFor="dropoff-location">Drop-off location</label>

          <div className="map-search-row">
            <input
              id="dropoff-location"
              value={dropoffQuery}
              onChange={(e) => setDropoffQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  findDropoff();
                }
              }}
              placeholder="Enter destination"
            />

            <button
              type="button"
              onClick={findDropoff}
              disabled={loading}
            >
              Find
            </button>
          </div>

          {dropoff && (
            <p className="map-selected-location">
              {dropoff.name}
            </p>
          )}
        </div>

        {error && (
          <p className="map-error" role="alert">
            {error}
          </p>
        )}

        {loading && (
          <p className="map-loading">
            Finding location or calculating route...
          </p>
        )}

        <div className="route-fare-card" ref={fareRef}>
          {estimatedFare !== null ? (
            <>
              <p className="fare-card-label">Estimated trip fare</p>

              <h2>₹{estimatedFare.toFixed(2)}</h2>

              <div className="fare-card-divider" />

              <p>
                <span>Driving distance</span>
                <strong>{distanceKm.toFixed(2)} km</strong>
              </p>

              <p>
                <span>Base fare</span>
                <strong>₹40.00</strong>
              </p>

              <p>
                <span>Distance charge</span>
                <strong>₹{(distanceKm * 12).toFixed(2)}</strong>
              </p>

              <p className="fare-card-note">
                This is an estimate based on the calculated route.
              </p>
            </>
          ) : (
            <div className="fare-placeholder">
              <h4>Your fare will appear here</h4>
              <p>
                Find your pickup and destination to calculate
                the driving distance and estimated price.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
