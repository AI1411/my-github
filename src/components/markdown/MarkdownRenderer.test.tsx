import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders headings", () => {
    render(<MarkdownRenderer source="# Hello" />);
    expect(screen.getByRole("heading", { name: "Hello" })).toBeInTheDocument();
  });

  it("renders inline code as <code>", () => {
    const { container } = render(<MarkdownRenderer source="use `npm` here" />);
    expect(container.querySelector("code")?.textContent).toBe("npm");
  });

  it("renders GFM tables", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<MarkdownRenderer source={md} />);
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("renders GFM task lists with checkboxes", () => {
    render(<MarkdownRenderer source={"- [x] done\n- [ ] todo"} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
  });

  it("renders fenced code blocks with a hljs class", () => {
    const md = "```js\nconst x = 1;\n```";
    const { container } = render(<MarkdownRenderer source={md} />);
    const code = container.querySelector("pre code");
    expect(code?.className).toMatch(/hljs|language-js/);
  });

  it("sanitizes raw HTML to mitigate XSS", () => {
    const { container } = render(
      <MarkdownRenderer source={'<img src="x" onerror="alert(1)" />\n\nSafe text'} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Safe text")).toBeInTheDocument();
  });

  it("renders nothing useful (empty fragment) for empty input", () => {
    const { container } = render(<MarkdownRenderer source="" />);
    expect(container.textContent).toBe("");
  });
});
