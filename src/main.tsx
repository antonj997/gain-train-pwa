import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
import App from "./App";
import ErrorBoundary, { watchGlobalErrors } from "./components/ErrorBoundary";
import "./index.css";
import "./styles/usability.css";
import "./styles/pages.css";

const UPDATE_CHECK_MS = 60 * 60 * 1000;
let updateReady = false;
const update = registerSW({
  onNeedRefresh() {
    updateReady = true;
    showUpdate();
  },
  onOfflineReady() {
    toast("Ready to log offline");
  },
  // An installed app can stay open for days without a navigation, which is when
  // browsers normally look for a new version. Check on return and hourly.
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine) registration.update().catch(() => {});
    };
    setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  },
});
function showUpdate() {
  if (!updateReady || location.pathname.includes("/workout/")) return;
  toast("An app update is ready.", {
    id: "app-update",
    duration: Infinity,
    action: {
      label: "Update",
      onClick: () => {
        if (!location.pathname.includes("/workout/")) void update(true);
      },
    },
  });
}
window.addEventListener("gain-route-change", showUpdate);
watchGlobalErrors();
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Remove the legacy network cache; workout records live in IndexedDB.
if ("caches" in window) void caches.delete("supabase-cache");
