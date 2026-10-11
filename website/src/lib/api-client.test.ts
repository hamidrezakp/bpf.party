import { afterEach, describe, expect, it, vi } from "vitest";
import { runCode } from "./api-client";

afterEach(() => vi.unstubAllGlobals());

function streamResponse(chunks: string[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) =>
          controller.enqueue(new TextEncoder().encode(chunk)),
        );
        controller.close();
      },
    }),
  );
}

function execute(chunks: string[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse(chunks)));
  const onEvent = vi.fn();
  const onError = vi.fn();
  const finished = new Promise<void>((resolve) => {
    runCode(
      "code",
      "test",
      onEvent,
      (error) => {
        onError(error);
        resolve();
      },
      resolve,
    );
  });
  return { onEvent, onError, finished };
}

describe("runCode", () => {
  it("delivers a final event even if the stream ends without a newline", async () => {
    const { onEvent, finished } = execute(['data: {"type":"correctAnswer"}']);
    await finished;
    expect(onEvent).toHaveBeenCalledWith({ type: "correctAnswer" });
  });

  it("parses multiline SSE data, CRLF, comments and arbitrary chunk boundaries", async () => {
    const { onEvent, onError, finished } = execute([
      ': heartbeat\r\ndata:{"type":\r',
      '\ndata: "correctAnswer"}\r\n\r',
      "\n",
    ]);
    await finished;
    expect(onError).not.toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ type: "correctAnswer" });
  });

  it("reports malformed JSON as a request error instead of silently dropping it", async () => {
    const { onEvent, onError, finished } = execute(["data: nope\n\n"]);
    await finished;
    expect(onError).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "requestError" }),
    );
  });

  it("reports HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 502 })),
    );
    const onError = vi.fn();
    await new Promise<void>((resolve) =>
      runCode(
        "code",
        "test",
        vi.fn(),
        (error) => {
          onError(error);
          resolve();
        },
        resolve,
      ),
    );
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("502"));
  });

  it("does not dispatch callbacks after cancellation", async () => {
    let respond!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      ),
    );
    const onEvent = vi.fn();
    const onError = vi.fn();
    const onComplete = vi.fn();
    const cancel = runCode("code", "test", onEvent, onError, onComplete);
    cancel();
    const streamCancelled = vi.fn();
    respond(
      new Response(
        new ReadableStream({
          cancel: streamCancelled,
        }),
      ),
    );
    await vi.waitFor(() => expect(streamCancelled).toHaveBeenCalledOnce());
    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("cancels an active reader without completion or further events", async () => {
    let enqueue!: ReadableStreamDefaultController<Uint8Array>;
    const streamCancelled = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              enqueue = controller;
            },
            cancel: streamCancelled,
          }),
        ),
      ),
    );
    const onEvent = vi.fn();
    const onError = vi.fn();
    const onComplete = vi.fn();
    const cancel = runCode("code", "test", onEvent, onError, onComplete);
    enqueue.enqueue(new TextEncoder().encode('data: {"type":"compiling"}\n\n'));
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledOnce());
    cancel();
    await vi.waitFor(() => expect(streamCancelled).toHaveBeenCalledOnce());
    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ type: "compiling" });
  });

  it("does not complete if cancelled by the final event callback", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(streamResponse(['data: {"type":"correctAnswer"}'])),
    );
    const onComplete = vi.fn();
    const onEvent = vi.fn(() => cancel());
    const cancel = runCode("code", "test", onEvent, vi.fn(), onComplete);
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledOnce());
    expect(onComplete).not.toHaveBeenCalled();
  });
});
