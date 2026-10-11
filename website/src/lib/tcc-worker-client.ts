import type { WorkerRequest, WorkerResponse, TccError } from "../types/worker";
import TccWorker from "../workers/tcc-worker.ts?worker";

export interface CheckResult {
  result: number;
  typeInfo: string | null;
  debTypeInfo: string | null;
  errors: TccError[];
  output: string;
}

interface PendingCheck {
  request: WorkerRequest;
  resolve: (result: CheckResult) => void;
  reject: (error: Error) => void;
}

// Serialize requests: stdout/stderr belong to the active request, and a run
// must never consume the result of an earlier as-you-type check.
export class TccWorkerClient {
  private worker: Worker;
  private ready = false;
  private failure: Error | null = null;
  private queue: PendingCheck[] = [];
  private active: PendingCheck | null = null;
  private output = "";
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private onReady: () => void,
    private onError: (error: string) => void,
  ) {
    this.worker = new TccWorker();
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      switch (message.type) {
        case "ready":
          this.clearTimeout();
          this.ready = true;
          this.onReady();
          this.pump();
          break;
        case "stdout":
        case "stderr":
          this.output += message.text + "\n";
          break;
        case "result": {
          this.clearTimeout();
          const active = this.active;
          this.active = null;
          active?.resolve({ ...message, output: this.output });
          this.pump();
          break;
        }
        case "error":
          this.fail(new Error(message.message));
          break;
      }
    };
    this.worker.onerror = (event) => this.fail(new Error(event.message));
    this.worker.onmessageerror = () =>
      this.fail(new Error("Invalid response from compiler worker"));
    this.startTimeout();
  }

  checkSyntax(code: string, withTypeInfo: boolean): Promise<CheckResult> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.queue.push({
        request: { type: "typecheck", code, withTypeInfo },
        resolve,
        reject,
      });
      this.pump();
    });
  }

  private pump() {
    if (!this.ready || this.active || this.failure) return;
    this.active = this.queue.shift() ?? null;
    if (!this.active) return;
    this.output = "";
    this.startTimeout();
    this.worker.postMessage(this.active.request);
  }

  private startTimeout() {
    this.clearTimeout();
    this.timeout = setTimeout(
      () => this.fail(new Error("Compiler worker timed out")),
      30_000,
    );
  }

  private clearTimeout() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
  }

  private fail(error: Error) {
    if (this.failure) return;
    this.failure = error;
    this.clearTimeout();
    this.worker.terminate();
    this.active?.reject(error);
    this.active = null;
    this.queue.splice(0).forEach((pending) => pending.reject(error));
    this.onError(error.message);
  }

  terminate() {
    this.clearTimeout();
    this.failure = new Error("Compiler worker terminated");
    this.worker.terminate();
    this.active?.reject(this.failure);
    this.active = null;
    this.queue.splice(0).forEach((pending) => pending.reject(this.failure!));
  }
}
