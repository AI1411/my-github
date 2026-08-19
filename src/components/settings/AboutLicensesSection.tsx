import { DEPENDENCY_LICENSES } from "./dependencyLicenses";
import { Row, Section } from "./settingsUi";

export function AboutLicensesSection() {
  return (
    <Section title="Dependency licenses">
      <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Major runtime dependencies. Full license texts ship with each package or crate.
      </p>
      <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {DEPENDENCY_LICENSES.map((dep) => (
          <Row key={dep.name} label={dep.name}>
            <span className="font-mono text-xs">{dep.license}</span>
          </Row>
        ))}
      </div>
    </Section>
  );
}
