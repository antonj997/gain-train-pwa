import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { recoveryRedirect } from "@/lib/authRecovery";

type FormMode = "signin" | "signup" | "reset";
export default function Auth() {
  const { user, passwordRecovery, recoveredSession, finishPasswordRecovery } =
    useAuth();
  const { online } = useData();
  const navigate = useNavigate();
  const [formMode, setFormMode] = useState<FormMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const mode = passwordRecovery
    ? recoveredSession
      ? "update"
      : "reset"
    : formMode;
  useEffect(() => {
    if (user && !passwordRecovery) navigate("/", { replace: true });
  }, [user, passwordRecovery, navigate]);
  const changeMode = (next: FormMode) => {
    finishPasswordRecovery();
    setFormMode(next);
    setPassword("");
    setConfirmation("");
    setMessage("");
    setError("");
    navigate("/auth", { replace: true });
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || busy) return;
    setMessage("");
    setError("");
    if (!online) {
      setError(
        "Connect to the internet to use your account. Your phone log is still available.",
      );
      return;
    }
    if (mode === "update" && password !== confirmation) {
      setError(
        "The passwords do not match. Enter the same new password twice.",
      );
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: recoveryRedirect(
              import.meta.env.BASE_URL,
              location.origin,
            ),
          },
        );
        if (error) throw error;
        setMessage(
          "If an account uses this email, you’ll receive a password-reset link. Open it to choose a new password.",
        );
      } else if (mode === "update") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        finishPasswordRecovery();
        setPassword("");
        setConfirmation("");
        navigate("/", { replace: true });
      } else {
        const { data, error } =
          mode === "signup"
            ? await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                  emailRedirectTo: new URL(
                    import.meta.env.BASE_URL,
                    location.origin,
                  ).href,
                },
              })
            : await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
        if (error) throw error;
        if (data.session) navigate("/", { replace: true });
        else
          setMessage(
            "Check your email to confirm your account, then sign in here.",
          );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not complete this request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page stack">
      <Link className="back-link" to="/" onClick={finishPasswordRecovery}>
        <ArrowLeft size={18} /> Back
      </Link>
      <h1>
        {mode === "update"
          ? "Choose a new password"
          : mode === "reset"
            ? "Reset your password"
            : mode === "signup"
              ? "Create an account"
              : "Sign in to sync"}
      </h1>
      <p>
        {mode === "update"
          ? "Enter a new password for your account. Use at least 8 characters."
          : mode === "reset"
            ? "Enter your account email and we’ll send a link to choose a new password."
            : "Sync your workout log across devices. You can keep logging on this phone without an account."}
      </p>
      {passwordRecovery && !recoveredSession && (
        <p className="notice" role="status">
          This reset link is unavailable or has expired. Request a new link
          below.
        </p>
      )}
      {supabase ? (
        <form
          className="stack"
          onSubmit={(event) => void submit(event)}
          aria-busy={busy}
        >
          {mode !== "update" && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                disabled={busy}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              {mode === "update" ? "New password" : "Password"}
              <input
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                minLength={mode === "signin" ? 1 : 8}
                required
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}
          {mode === "update" && (
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={busy}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "update"
                ? "Save new password"
                : mode === "reset"
                  ? "Send reset link"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
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
      {supabase && mode === "signin" && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => changeMode("reset")}
        >
          Forgot password?
        </button>
      )}
      {supabase && mode !== "update" && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Create an account" : "Back to sign in"}
        </button>
      )}
    </div>
  );
}
