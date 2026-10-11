import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerResponse } from "../types/worker";
import { TccWorkerClient } from "./tcc-worker-client";

const { workers } = vi.hoisted(() => ({
  workers: [] as Array<{
    onmessage: ((event: { data: WorkerResponse }) => void) | null;
    onerror: ((event: { message: string }) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("../workers/tcc-worker.ts?worker", () => ({
  default: class {
    onmessage = null;
    onerror = null;
    onmessageerror = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() {
      workers.push(this);
    }
  },
}));

beforeEach(() => {
  workers.length = 0;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());
const result: WorkerResponse = {
  type: "result",
  result: 0,
  typeInfo: "[]",
  debTypeInfo: "[]",
  errors: [],
};

describe("TccWorkerClient", () => {
  it("waits for readiness and serializes checks with request-specific output", async () => {
    const onReady = vi.fn();
    const client = new TccWorkerClient(onReady, vi.fn());
    const first = client.checkSyntax("first", false);
    const second = client.checkSyntax("run", true);
    const worker = workers[0];
    expect(worker.postMessage).not.toHaveBeenCalled();
    worker.onmessage!({ data: { type: "ready" } });
    expect(onReady).toHaveBeenCalledOnce();
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: "typecheck",
      code: "first",
      withTypeInfo: false,
    });
    worker.onmessage!({ data: { type: "stdout", text: "first output" } });
    worker.onmessage!({ data: result });
    await expect(first).resolves.toMatchObject({
      result: 0,
      output: "first output\n",
    });
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      type: "typecheck",
      code: "run",
      withTypeInfo: true,
    });
    worker.onmessage!({ data: { type: "stderr", text: "run warning" } });
    worker.onmessage!({ data: result });
    await expect(second).resolves.toMatchObject({ output: "run warning\n" });
    client.terminate();
  });

  it("rejects active, queued, and future requests on a fatal worker error", async () => {
    const onError = vi.fn();
    const client = new TccWorkerClient(vi.fn(), onError);
    workers[0].onmessage!({ data: { type: "ready" } });
    const active = expect(client.checkSyntax("active", false)).rejects.toThrow(
      "broken",
    );
    const queued = expect(client.checkSyntax("queued", true)).rejects.toThrow(
      "broken",
    );
    workers[0].onmessage!({ data: { type: "error", message: "broken" } });
    await Promise.all([active, queued]);
    await expect(client.checkSyntax("future", false)).rejects.toThrow("broken");
    expect(onError).toHaveBeenCalledExactlyOnceWith("broken");
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "times out a stalled worker (ready: %s)",
    async (ready) => {
      const onError = vi.fn();
      const client = new TccWorkerClient(vi.fn(), onError);
      if (ready) workers[0].onmessage!({ data: { type: "ready" } });
      const rejected = expect(
        client.checkSyntax("code", false),
      ).rejects.toThrow("timed out");
      vi.advanceTimersByTime(30_000);
      await rejected;
      expect(onError).toHaveBeenCalledOnce();
    },
  );

  it("rejects pending checks on termination without a user-facing error", async () => {
    const onError = vi.fn();
    const client = new TccWorkerClient(vi.fn(), onError);
    const rejected = expect(client.checkSyntax("code", false)).rejects.toThrow(
      "terminated",
    );
    client.terminate();
    await rejected;
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
