import { describe, expect, it, vi } from "vitest";
import {
  assertLlmEndpointAllowed,
  buildPrSummaryPrompt,
  generateLocalSummary,
  isLocalEndpoint,
} from "./localLlm";

describe("localLlm", () => {
  it("detects local endpoints", () => {
    expect(isLocalEndpoint("http://127.0.0.1:11434")).toBe(true);
    expect(isLocalEndpoint("https://api.example.com")).toBe(false);
  });

  it("blocks remote unless allowed", () => {
    expect(() =>
      assertLlmEndpointAllowed({
        endpoint: "https://api.example.com",
        allowRemote: false,
      }),
    ).toThrow(/Remote LLM/);
  });

  it("builds a reviewer prompt", () => {
    const prompt = buildPrSummaryPrompt({
      title: "Add auth",
      body: "Implements login",
      files: [{ filename: "src/a.ts", status: "modified", additions: 10, deletions: 2 }],
    });
    expect(prompt).toContain("Add auth");
    expect(prompt).toContain("src/a.ts");
  });

  it("calls Ollama generate", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "Looks good overview." }),
    });
    const text = await generateLocalSummary(
      {
        enabled: true,
        allowRemote: false,
        endpoint: "http://127.0.0.1:11434",
        model: "llama3.2",
      },
      "prompt",
      fetchImpl as unknown as typeof fetch,
    );
    expect(text).toBe("Looks good overview.");
    expect(fetchImpl).toHaveBeenCalled();
  });
});
