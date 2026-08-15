import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueTimeline } from "./IssueTimeline";
import type { TimelineEventSummary } from "../../features/issues/useIssueTimelineQuery";

function ev(partial: Partial<TimelineEventSummary> & { event: string }): TimelineEventSummary {
  return {
    id: partial.id ?? 1,
    event: partial.event,
    createdAt: partial.createdAt ?? "2026-04-21T00:00:00Z",
    actorLogin: partial.actorLogin ?? "octocat",
    labelName: partial.labelName ?? null,
    labelColor: partial.labelColor ?? null,
    assigneeLogin: partial.assigneeLogin ?? null,
    milestoneTitle: partial.milestoneTitle ?? null,
    crossRefTitle: partial.crossRefTitle ?? null,
    crossRefNumber: partial.crossRefNumber ?? null,
    crossRefUrl: partial.crossRefUrl ?? null,
    body: partial.body ?? null,
  };
}

describe("IssueTimeline", () => {
  it("renders label / assign / milestone / cross-ref separators chronologically", () => {
    render(
      <IssueTimeline
        events={[
          ev({
            id: 1,
            event: "labeled",
            labelName: "bug",
            labelColor: "d73a4a",
            createdAt: "2026-04-20T00:00:00Z",
          }),
          ev({
            id: 2,
            event: "assigned",
            assigneeLogin: "alice",
            createdAt: "2026-04-20T01:00:00Z",
          }),
          ev({
            id: 3,
            event: "milestoned",
            milestoneTitle: "v1",
            createdAt: "2026-04-20T02:00:00Z",
          }),
          ev({
            id: 4,
            event: "cross-referenced",
            crossRefNumber: 9,
            crossRefTitle: "Related",
            crossRefUrl: "https://github.com/o/r/issues/9",
            createdAt: "2026-04-20T03:00:00Z",
          }),
          ev({ id: 5, event: "commented", body: "hi" }),
        ]}
      />,
    );

    const list = screen.getByRole("list", { name: /issue timeline/i });
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(/added label/i);
    expect(items[1]).toHaveTextContent(/assigned alice/i);
    expect(items[2]).toHaveTextContent(/milestone v1/i);
    expect(items[3]).toHaveTextContent(/mentioned this in #9/i);
    expect(screen.queryByText("hi")).not.toBeInTheDocument();
  });

  it("returns null when there are no separator events", () => {
    const { container } = render(
      <IssueTimeline events={[ev({ event: "commented", body: "only comment" })]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
