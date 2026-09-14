import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
import App from "./App";
import "./index.css";

let updateReady = false;
const update = registerSW({
  onNeedRefresh() {
    updateReady = true;
    showUpdate();
  },
  onOfflineReady() {
    toast("Ready to log offline");
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
createRoot(document.getElementById("root")!).render(<App />);

// Remove the legacy network cache; workout records live in IndexedDB.
if ("caches" in window) void caches.delete("supabase-cache");
