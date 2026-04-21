import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueSidebar } from "./IssueSidebar";

describe("IssueSidebar", () => {
  it("renders all section headings", () => {
    render(
      <IssueSidebar
        assignees={[]}
        labels={[]}
        milestone={null}
        linkedPrs={[]}
        participants={[]}
        subscribed={false}
      />,
    );
    expect(screen.getByText("Assignees")).toBeInTheDocument();
    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByText("Milestone")).toBeInTheDocument();
    expect(screen.getByText("Linked PRs")).toBeInTheDocument();
    expect(screen.getByText("Participants")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("renders milestone with progress bar showing percent", () => {
    render(
      <IssueSidebar
        assignees={[]}
        labels={[]}
        milestone={{
          title: "v0.1",
          openIssues: 1,
          closedIssues: 3,
        }}
        linkedPrs={[]}
        participants={[]}
        subscribed={false}
      />,
    );
    expect(screen.getByText("v0.1")).toBeInTheDocument();
    const bar = screen.getByTestId("milestone-progress-fill");
    // 3/4 closed => 75%
    expect(bar.style.width).toBe("75%");
  });

  it("renders linked PR rows", () => {
    render(
      <IssueSidebar
        assignees={[]}
        labels={[]}
        milestone={null}
        linkedPrs={[
          {
            owner: "o",
            repo: "r",
            number: 5,
            title: "Fix",
            state: "open",
          },
        ]}
        participants={[]}
        subscribed={false}
      />,
    );
    expect(screen.getByText(/#5 Fix/)).toBeInTheDocument();
  });

  it("shows Subscribed when subscribed=true", () => {
    render(
      <IssueSidebar
        assignees={[]}
        labels={[]}
        milestone={null}
        linkedPrs={[]}
        participants={[]}
        subscribed={true}
      />,
    );
    expect(screen.getByText("Subscribed")).toBeInTheDocument();
  });

  it("shows Not subscribed when subscribed=false", () => {
    render(
      <IssueSidebar
        assignees={[]}
        labels={[]}
        milestone={null}
        linkedPrs={[]}
        participants={[]}
        subscribed={false}
      />,
    );
    expect(screen.getByText("Not subscribed")).toBeInTheDocument();
  });
});
