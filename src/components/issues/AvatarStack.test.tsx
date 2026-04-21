import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvatarStack } from "./AvatarStack";

describe("AvatarStack", () => {
  it("renders all users when count <= max", () => {
    render(
      <AvatarStack
        users={[
          { login: "a", avatarUrl: "" },
          { login: "b", avatarUrl: "" },
        ]}
        max={3}
      />,
    );
    expect(screen.getAllByTitle(/^[ab]$/)).toHaveLength(2);
  });

  it("renders +N indicator when overflow", () => {
    render(
      <AvatarStack
        users={[
          { login: "a", avatarUrl: "" },
          { login: "b", avatarUrl: "" },
          { login: "c", avatarUrl: "" },
          { login: "d", avatarUrl: "" },
        ]}
        max={2}
      />,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders nothing when users is empty", () => {
    const { container } = render(<AvatarStack users={[]} max={3} />);
    expect(container.firstChild).toBeNull();
  });
});
