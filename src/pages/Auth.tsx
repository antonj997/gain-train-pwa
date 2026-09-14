import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
export default function Auth() {
  const { user } = useAuth(),
    navigate = useNavigate();
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = signup
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: new URL(
                import.meta.env.BASE_URL,
                location.origin,
              ).href,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) navigate("/");
      else
        setMessage(
          "Check your email to confirm your account, then sign in here.",
        );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page stack">
      <Link to="/">← Back to your workouts</Link>
      <h1>
        {signup ? "Keep your progress with you" : "Sync your workout log"}
      </h1>
      <p>
        Sign in to back up your workouts and access them on another device. You
        can keep logging on this phone without signing in.
      </p>
      {supabase ? (
        <form className="stack" onSubmit={(e) => void submit(e)}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={signup ? 8 : 1}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </button>
        </form>
      ) : (
        <p className="notice">
          Cloud sync is not configured. Your phone log still works.
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <button
        className="text-button"
        onClick={() => {
          setSignup(!signup);
          setMessage("");
        }}
      >
        {signup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
      <Link className="secondary" to="/">
        Continue on this phone
      </Link>
    </div>
  );
}
