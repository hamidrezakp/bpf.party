import type { SSEEvent } from "../types/sse-events";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:8081" : "";

export function runCode(
  code: string,
  exerciseId: string,
  onEvent: (event: SSEEvent) => void,
  onError: (error: string) => void,
  onComplete: () => void,
): () => void {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  async function run() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/run_code/${encodeURIComponent(exerciseId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            Accept: "text/event-stream",
          },
          body: code,
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) {
        await response.body?.cancel();
        return;
      }
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error("Response body is null");

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let data: string[] = [];

      function dispatch() {
        if (data.length && !controller.signal.aborted) {
          const event: SSEEvent = JSON.parse(data.join("\n"));
          onEvent(event);
        }
        data = [];
      }

      function processLine(line: string) {
        if (line === "") {
          dispatch();
          return;
        }
        if (line.startsWith(":")) return;
        const colon = line.indexOf(":");
        const field = colon < 0 ? line : line.slice(0, colon);
        let value = colon < 0 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "data") data.push(value);
      }

      function processText(text: string, final = false) {
        buffer += text;
        let index: number;
        while ((index = buffer.search(/[\r\n]/)) !== -1) {
          // A trailing CR might be the first half of a CRLF in the next chunk.
          if (!final && buffer[index] === "\r" && index === buffer.length - 1)
            break;
          const length =
            buffer[index] === "\r" && buffer[index + 1] === "\n" ? 2 : 1;
          processLine(buffer.slice(0, index));
          buffer = buffer.slice(index + length);
        }
        if (final) {
          if (buffer) processLine(buffer);
          buffer = "";
          dispatch();
        }
      }

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (controller.signal.aborted) return;
        if (done) {
          processText(decoder.decode(), true);
          if (!controller.signal.aborted) onComplete();
          return;
        }
        processText(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      onEvent({ type: "requestError", data: message });
      onError(message);
    } finally {
      try {
        await reader?.cancel();
      } catch {
        /* The stream may already be closed. */
      }
      reader?.releaseLock();
    }
  }

  void run();
  return () => {
    controller.abort();
    void reader?.cancel().catch(() => {});
  };
}
