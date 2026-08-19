import {
  useSettingsStore,
  type AppearanceLayout,
  type AppearanceTheme,
} from "../../stores/settingsStore";
import { InlineButton, Row, Section } from "./settingsUi";

export function AppearanceSettingsSection() {
  const density = useSettingsStore((s) => s.density);
  const theme = useSettingsStore((s) => s.theme);
  const layout = useSettingsStore((s) => s.layout);
  const setDensity = useSettingsStore((s) => s.setDensity);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setLayout = useSettingsStore((s) => s.setLayout);

  return (
    <Section title="Appearance">
      <Row label="Theme">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["dark", "Dark"],
              ["light", "Light"],
              ["system", "System"],
            ] as [AppearanceTheme, string][]
          ).map(([id, label]) => (
            <InlineButton key={id} active={theme === id} onClick={() => setTheme(id)}>
              {label}
            </InlineButton>
          ))}
        </div>
      </Row>
      <Row label="Density">
        <div className="flex flex-wrap gap-2">
          <InlineButton active={density === "comfortable"} onClick={() => setDensity("comfortable")}>
            Comfortable
          </InlineButton>
          <InlineButton active={density === "compact"} onClick={() => setDensity("compact")}>
            Compact
          </InlineButton>
        </div>
      </Row>
      <Row label="Home layout">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["inbox-first", "Inbox first"],
              ["pulls-first", "Pulls first"],
            ] as [AppearanceLayout, string][]
          ).map(([id, label]) => (
            <InlineButton key={id} active={layout === id} onClick={() => setLayout(id)}>
              {label}
            </InlineButton>
          ))}
        </div>
      </Row>
    </Section>
  );
}
