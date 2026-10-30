import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { recoveryRedirect } from "@/lib/authRecovery";
import { t } from "@/i18n";

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
      setError(t("auth.offline"));
      return;
    }
    if (mode === "update" && password !== confirmation) {
      setError(t("auth.mismatch"));
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
        setMessage(t("auth.resetSent"));
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
        else setMessage(t("auth.checkEmail"));
      }
    } catch (error) {
      setError(errorMessage(error, t("auth.failed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page stack">
      <Link className="back-link" to="/" onClick={finishPasswordRecovery}>
        <ArrowLeft size={18} /> {t("auth.back")}
      </Link>
      <h1>
        {mode === "update"
          ? t("auth.titleUpdate")
          : mode === "reset"
            ? t("auth.titleReset")
            : mode === "signup"
              ? t("auth.createAnAccount")
              : t("auth.titleSignin")}
      </h1>
      <p>
        {mode === "update"
          ? t("auth.textUpdate")
          : mode === "reset"
            ? t("auth.textReset")
            : t("auth.textSignin")}
      </p>
      {passwordRecovery && !recoveredSession && (
        <p className="notice" role="status">
          {t("auth.linkExpired")}
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
              {t("auth.email")}
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
              {mode === "update" ? t("auth.newPassword") : t("auth.password")}
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
              {t("auth.confirmPassword")}
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
              ? t("auth.pleaseWait")
              : mode === "update"
                ? t("auth.saveNewPassword")
                : mode === "reset"
                  ? t("auth.sendReset")
                  : mode === "signup"
                    ? t("auth.createAccount")
                    : t("auth.signIn")}
          </button>
        </form>
      ) : (
        <p className="notice">{t("auth.notConfigured")}</p>
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
          {mode === "signin"
            ? t("auth.createAnAccount")
            : t("auth.backToSignIn")}
        </button>
      )}
    </div>
  );
}
