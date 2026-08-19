import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  discardWrite,
  enqueueWrite,
  flushWriteQueue,
  loadWriteQueue,
  WRITE_QUEUE_STORAGE_KEY,
} from "./writeQueue";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  } as Storage;
}

describe("writeQueue persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty queue when nothing is stored", () => {
    expect(loadWriteQueue(memoryStorage())).toEqual([]);
  });

  it("persists enqueued writes to storage", () => {
    const storage = memoryStorage();
    const entry = enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 1 } },
      storage,
    );

    expect(entry.id).toBeTruthy();
    expect(entry.command).toBe("cmd_update_issue");
    expect(entry.args).toEqual({ owner: "o", repo: "r", number: 1 });
    expect(typeof entry.createdAt).toBe("number");
    expect(entry.lastError).toBeUndefined();

    const loaded = loadWriteQueue(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(entry);
    expect(storage.getItem(WRITE_QUEUE_STORAGE_KEY)).toContain("cmd_update_issue");
  });

  it("appends multiple writes in order", () => {
    const storage = memoryStorage();
    enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 1 } },
      storage,
    );
    enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 2 } },
      storage,
    );

    const loaded = loadWriteQueue(storage);
    expect(loaded.map((e) => e.args.number)).toEqual([1, 2]);
  });

  it("ignores corrupt stored JSON", () => {
    const storage = memoryStorage({ [WRITE_QUEUE_STORAGE_KEY]: "not-json" });
    expect(loadWriteQueue(storage)).toEqual([]);
  });

  it("discards a queued write by id", () => {
    const storage = memoryStorage();
    const a = enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 1 } },
      storage,
    );
    const b = enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 2 } },
      storage,
    );

    discardWrite(a.id, storage);
    expect(loadWriteQueue(storage).map((e) => e.id)).toEqual([b.id]);
  });
});

describe("flushWriteQueue", () => {
  it("invokes each pending command and clears successes", async () => {
    const storage = memoryStorage();
    enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 1 } },
      storage,
    );
    enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 2 } },
      storage,
    );

    const invoke = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });

    const result = await flushWriteQueue({ invoke, storage });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(1, "cmd_update_issue", {
      owner: "o",
      repo: "r",
      number: 1,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "cmd_update_issue", {
      owner: "o",
      repo: "r",
      number: 2,
    });
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(loadWriteQueue(storage)).toEqual([]);
  });

  it("keeps failed writes and records lastError", async () => {
    const storage = memoryStorage();
    enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 1 } },
      storage,
    );
    enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 2 } },
      storage,
    );

    const invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true });

    const result = await flushWriteQueue({ invoke, storage });

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    const remaining = loadWriteQueue(storage);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.args).toEqual({ number: 1 });
    expect(remaining[0]?.lastError).toBe("network down");
  });

  it("skips flush when navigator reports offline", async () => {
    const storage = memoryStorage();
    enqueueWrite(
      { command: "cmd_update_issue", args: { owner: "o", repo: "r", number: 1 } },
      storage,
    );
    const invoke = vi.fn();

    const result = await flushWriteQueue({
      invoke,
      storage,
      isOnline: () => false,
    });

    expect(invoke).not.toHaveBeenCalled();
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(loadWriteQueue(storage)).toHaveLength(1);
  });
});
