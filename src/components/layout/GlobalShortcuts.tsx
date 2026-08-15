import { useNavigate } from "react-router-dom";
import { useSettingsShortcut } from "../../hooks/useSettingsShortcut";

/** App-wide bindings that are advertised in Settings but have no page-local owner. */
export function GlobalShortcuts() {
  const navigate = useNavigate();

  useSettingsShortcut("goInbox", () => {
    navigate("/inbox");
  });
  useSettingsShortcut("goPulls", () => {
    navigate("/pulls");
  });
  useSettingsShortcut("goSettings", () => {
    navigate("/settings");
  });

  return null;
}
