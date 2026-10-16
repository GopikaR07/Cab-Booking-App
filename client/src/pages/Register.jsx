
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CarFront, UserRound, Mail, Lock, Phone } from "lucide-react";
import "./auth.css";

export default function Register() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    role: "rider",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function updateField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      navigate("/login");
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

        <h1>Create your account</h1>
        <p className="subtitle">Get ready for your next journey.</p>

        <form onSubmit={handleSubmit}>
          <label>Full name</label>
          <div className="input-wrap">
            <UserRound size={18} />
            <input
              name="full_name"
              value={form.full_name}
              onChange={updateField}
              placeholder="Your full name"
              required
              maxLength={100}
            />
          </div>

          <label>Email address</label>
          <div className="input-wrap">
            <Mail size={18} />
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={updateField}
              placeholder="you@example.com"
              required
            />
          </div>

          <label>Phone number</label>
          <div className="input-wrap">
            <Phone size={18} />
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={updateField}
              placeholder="Your phone number"
            />
          </div>

          <label>Password</label>
          <div className="input-wrap">
            <Lock size={18} />
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={updateField}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>

          <label>I want to join as</label>
          <select
            name="role"
            value={form.role}
            onChange={updateField}
            className="role-select"
          >
            <option value="rider">Rider — book rides</option>
            <option value="driver">Driver — accept rides</option>
          </select>

          {error && <p className="error-message">{error}</p>}

          <button className="primary-btn" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
