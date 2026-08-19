import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

/** Render all rows in tests (jsdom has no real scroll metrics). */
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (opts: { count: number; estimateSize?: (index: number) => number }) => {
    const sizeOf = (index: number) => opts.estimateSize?.(index) ?? 40;
    let offset = 0;
    const items = Array.from({ length: opts.count }, (_, index) => {
      const size = sizeOf(index);
      const start = offset;
      offset += size;
      return { index, key: index, start, size, end: start + size };
    });
    return {
      getVirtualItems: () => items,
      getTotalSize: () => offset,
      measureElement: () => undefined,
      scrollToIndex: () => undefined,
    };
  },
}));
