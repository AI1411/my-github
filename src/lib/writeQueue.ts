import { appStorageKey } from "./appStorageKeys";
export const WRITE_QUEUE_STORAGE_KEY = appStorageKey("write-queue");

export type UpdateIssueWriteArgs = {
  owner: string;
  repo: string;
  number: number;
  state?: string | null;
  labels?: string[] | null;
  assignees?: string[] | null;
};

/** Discriminated union of offline write commands the queue can flush. */
export type WriteQueueCommand =
  | { command: "cmd_update_issue"; args: UpdateIssueWriteArgs };

export type WriteQueueEntry = {
  id: string;
  command: WriteQueueCommand["command"];
  args: WriteQueueCommand["args"];
  createdAt: number;
  lastError?: string;
};

export type EnqueueWriteInput = WriteQueueCommand;

type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export type FlushWriteQueueOptions = {
  invoke: InvokeFn;
  storage?: Pick<Storage, "getItem" | "setItem">;
  isOnline?: () => boolean;
};

export type FlushWriteQueueResult = {
  succeeded: number;
  failed: number;
};

type QueueListener = (queue: WriteQueueEntry[]) => void;

const listeners = new Set<QueueListener>();

/** In-memory snapshot for the default (localStorage) queue — stable for useSyncExternalStore. */
let cachedDefaultQueue: WriteQueueEntry[] | null = null;

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `wq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isEntry(value: unknown): value is WriteQueueEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.command === "string" &&
    typeof e.createdAt === "number" &&
    e.args !== null &&
    typeof e.args === "object" &&
    !Array.isArray(e.args)
  );
}

function parseQueue(raw: string | null): WriteQueueEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).map((e) => ({
      id: e.id,
      command: e.command,
      args: e.args as Record<string, unknown>,
      createdAt: e.createdAt,
      ...(typeof e.lastError === "string" ? { lastError: e.lastError } : {}),
    }));
  } catch {
    return [];
  }
}

function persist(queue: WriteQueueEntry[], storage: Pick<Storage, "setItem">): void {
  try {
    storage.setItem(WRITE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore persistence failures (quota / private mode)
  }
  if (typeof localStorage !== "undefined" && storage === localStorage) {
    cachedDefaultQueue = queue;
  }
  for (const listener of listeners) {
    listener(queue);
  }
}

export function subscribeWriteQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadWriteQueue(
  storage: Pick<Storage, "getItem"> = localStorage,
): WriteQueueEntry[] {
  if (typeof localStorage !== "undefined" && storage === localStorage) {
    if (cachedDefaultQueue === null) {
      cachedDefaultQueue = parseQueue(storage.getItem(WRITE_QUEUE_STORAGE_KEY));
    }
    return cachedDefaultQueue;
  }
  try {
    return parseQueue(storage.getItem(WRITE_QUEUE_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function enqueueWrite(
  input: EnqueueWriteInput,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): WriteQueueEntry {
  const entry: WriteQueueEntry = {
    id: createId(),
    command: input.command,
    args: input.args,
    createdAt: Date.now(),
  };
  const queue = [...loadWriteQueue(storage), entry];
  persist(queue, storage);
  return entry;
}

export function discardWrite(
  id: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): void {
  const queue = loadWriteQueue(storage).filter((e) => e.id !== id);
  persist(queue, storage);
}

export function clearWriteQueue(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): void {
  persist([], storage);
}

/** Test helper: drop the in-memory cache so the next load re-reads storage. */
export function resetWriteQueueCacheForTests(): void {
  cachedDefaultQueue = null;
}

function defaultIsOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function flushWriteQueue(
  options: FlushWriteQueueOptions,
): Promise<FlushWriteQueueResult> {
  const storage = options.storage ?? localStorage;
  const isOnline = options.isOnline ?? defaultIsOnline;

  if (!isOnline()) {
    return { succeeded: 0, failed: 0 };
  }

  const queue = loadWriteQueue(storage);
  if (queue.length === 0) {
    return { succeeded: 0, failed: 0 };
  }

  const remaining: WriteQueueEntry[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      await options.invoke(entry.command, entry.args);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      remaining.push({
        ...entry,
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  persist(remaining, storage);
  return { succeeded, failed };
}
