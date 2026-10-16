
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CarFront, Mail, Lock } from "lucide-react";
import "./auth.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      sessionStorage.setItem("cabToken", data.token);
      sessionStorage.setItem("cabUser", JSON.stringify(data.user));

      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">
          <span className="brand-icon"><CarFront size={28} /></span>
          <span>RideOn</span>
        </div>

        <h1>Welcome back</h1>
        <p className="subtitle">Your next ride is just a few clicks away.</p>

        <form onSubmit={handleSubmit}>
          <label>Email address</label>
          <div className="input-wrap">
            <Mail size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <label>Password</label>
          <div className="input-wrap">
            <Lock size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button className="primary-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          New to RideOn? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
