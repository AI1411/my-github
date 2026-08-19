import type { ReactNode } from "react";
import { DEPENDENCY_LICENSES } from "./dependencyLicenses";

function sectionStyle() {
  return { borderColor: "var(--border-subtle)" };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="grid min-h-11 grid-cols-[220px_1fr] items-center gap-4 border-t py-2 first:border-t-0"
      style={sectionStyle()}
    >
      <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="min-w-0 text-sm" style={{ color: "var(--text-primary)" }}>
        {children}
      </div>
    </div>
  );
}

export function AboutLicensesSection() {
  return (
    <section className="border-b px-6 py-5" style={sectionStyle()}>
      <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Dependency licenses
      </h2>
      <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Major runtime dependencies. Full license texts ship with each package or crate.
      </p>
      <div className="divide-y" style={sectionStyle()}>
        {DEPENDENCY_LICENSES.map((dep) => (
          <Row key={dep.name} label={dep.name}>
            <span className="font-mono text-xs">{dep.license}</span>
          </Row>
        ))}
      </div>
    </section>
  );
}
