import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsShortcut } from "../../hooks/useSettingsShortcut";
import { useDataStore } from "../../stores/dataStore";

/** App-wide bindings that are advertised in Settings but have no page-local owner. */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const markLastSynced = useDataStore((s) => s.markLastSynced);

  useSettingsShortcut("goInbox", () => {
    navigate("/inbox");
  });
  useSettingsShortcut("goPulls", () => {
    navigate("/pulls");
  });
  useSettingsShortcut("goSettings", () => {
    navigate("/settings");
  });
  useSettingsShortcut("syncNow", () => {
    void invoke("cmd_sync_now").then(() => markLastSynced());
  });

  return null;
}
