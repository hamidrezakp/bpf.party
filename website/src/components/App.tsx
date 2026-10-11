import { useCallback, useEffect, useRef, useState } from "react";
import { TccWorkerClient, type CheckResult } from "../lib/tcc-worker-client";
import {
  readStorage,
  writeStorage,
  removeStorage,
  readLayout,
} from "../lib/storage";
import { runCode } from "../lib/api-client";
import { debTypeRegistry } from "../lib/deb-type-registry";
import CodeEditor from "./CodeEditor";
import CompilerOutput from "./CompilerOutput";
import RunButton from "./RunButton";
import EventViewer from "./EventViewer";
import StructViewer from "./StructViewer";
import ControlButton from "./ControlButton";
import { Panel, Group, Separator } from "react-resizable-panels";
import type { TypeInfo } from "../types/typeinfo";
import type { DebTypeInfo } from "../types/debtypeinfo";
import type { SSEEvent } from "../types/sse-events";
import styles from "./App.module.css";
import { RotateCcw, Braces, Keyboard } from "lucide-react";

interface AppProps {
  starterCode: string;
  exerciseId: string;
  chapterId?: number;
  codeFile?: string;
}

export default function App({
  starterCode,
  exerciseId,
  chapterId,
  codeFile,
}: AppProps) {
  if (!exerciseId) {
    throw new Error("Missing exerciseId");
  }
  if (!starterCode) {
    throw new Error("Missing starterCode");
  }
  const DEBOUNCE_TIME_MS = 200;
  const codeStorageKey = `user-code-${exerciseId}`;

  const getInitialCode = () => {
    if (typeof window === "undefined") return starterCode;
    const savedCode = readStorage(codeStorageKey);
    return savedCode !== null ? savedCode : starterCode;
  };

  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState("");
  const [workerReady, setWorkerReady] = useState(false);
  const [workerError, setWorkerError] = useState(false);
  const [droppedEvents, setDroppedEvents] = useState(0);
  const [outputClass, setOutputClass] = useState<"warning" | "error" | "">("");
  const [typeInfo, setTypeInfo] = useState<{ [name: string]: TypeInfo }>({});
  const [selectedStructName, setSelectedStructName] = useState<string | null>(
    null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [savedLayout, setSavedLayout] = useState<
    { [key: string]: number } | undefined
  >(undefined);
  const [layoutReady, setLayoutReady] = useState(false);
  const [compileAsYouType, setCompileAsYouType] = useState(true);
  const [vimMode, setVimMode] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const workerRef = useRef<TccWorkerClient | null>(null);
  const mountedRef = useRef(false);
  const runningRef = useRef(false);
  const checkVersionRef = useRef(0);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventsRef = useRef<SSEEvent[]>([]);
  const debugEventCountRef = useRef(0);
  const droppedEventCountRef = useRef(0);
  const abortRunRef = useRef<(() => void) | null>(null);
  const currentCodeRef = useRef(starterCode);
  const resetDialogRef = useRef<HTMLDialogElement | null>(null);

  const displayResult = useCallback((result: CheckResult) => {
    if (!mountedRef.current) return;
    let text = result.output;
    result.errors.forEach((error) => {
      text += `${error.isWarning ? "Warning" : "Error"} at ${error.filename ?? "<unknown>"}:${error.lineNum}: ${error.msg}\n`;
    });
    if (result.result !== 0 && !text) text = "Syntax check failed.";
    setOutput(text);
    setOutputClass(
      result.result !== 0 || result.errors.some((e) => !e.isWarning)
        ? "error"
        : text
          ? "warning"
          : "",
    );
    if (result.typeInfo) {
      const parsed: TypeInfo[] = JSON.parse(result.typeInfo);
      setTypeInfo(Object.fromEntries(parsed.map((type) => [type.name, type])));
    }
    if (result.debTypeInfo) {
      const parsed: DebTypeInfo[] = JSON.parse(result.debTypeInfo);
      debTypeRegistry.set(parsed);
    }
  }, []);

  const performCheck = useCallback(
    async (value: string, withTypeInfo = false) => {
      const version = ++checkVersionRef.current;
      try {
        const result = await workerRef.current?.checkSyntax(
          value,
          withTypeInfo,
        );
        if (result && version === checkVersionRef.current)
          displayResult(result);
        return result;
      } catch (error) {
        if (mountedRef.current) {
          setOutput(error instanceof Error ? error.message : String(error));
          setOutputClass("error");
        }
        return undefined;
      }
    },
    [displayResult],
  );

  useEffect(() => {
    mountedRef.current = true;
    const initialCode = getInitialCode();
    setCode(initialCode);
    currentCodeRef.current = initialCode;
    const worker = new TccWorkerClient(
      () => {
        setWorkerReady(true);
        void performCheck(currentCodeRef.current, true);
      },
      (error) => {
        setWorkerReady(false);
        setWorkerError(true);
        setOutput(error);
        setOutputClass("error");
      },
    );

    workerRef.current = worker;

    return () => {
      mountedRef.current = false;
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
      writeStorage(codeStorageKey, currentCodeRef.current);
      worker.terminate();
      abortRunRef.current?.();
    };
  }, []);

  useEffect(() => {
    const storageKey = `ebpf-party-layout`;
    setSavedLayout(readLayout(storageKey));
    setLayoutReady(true);

    const compileSettingKey = `ebpf-party-compile-as-you-type`;
    const savedCompileSetting = readStorage(compileSettingKey);
    if (savedCompileSetting !== null) {
      setCompileAsYouType(savedCompileSetting === "true");
    }

    const savedVimMode = readStorage("ebpf-party-vim-mode");
    if (savedVimMode !== null) {
      setVimMode(savedVimMode === "true");
    }
  }, []);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    currentCodeRef.current = newCode;
    // Persist drafts, not just programs that have been run.
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(
      () => writeStorage(codeStorageKey, newCode),
      400,
    );
    ++checkVersionRef.current;
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (!compileAsYouType || !workerReady || runningRef.current) return;
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
      void performCheck(currentCodeRef.current);
    }, DEBOUNCE_TIME_MS);
  };

  const handleSelectStruct = (name: string) => {
    if (typeInfo[name]) {
      setSelectedStructName(name);
    }
  };

  const flushEvents = () => {
    if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
    const batch = pendingEventsRef.current.splice(0);
    if (mountedRef.current) {
      if (batch.length) setEvents((previous) => [...previous, ...batch]);
      setDroppedEvents(droppedEventCountRef.current);
    }
    eventTimeoutRef.current = null;
  };

  const clearEvents = () => {
    if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
    eventTimeoutRef.current = null;
    pendingEventsRef.current = [];
    debugEventCountRef.current = 0;
    droppedEventCountRef.current = 0;
    setDroppedEvents(0);
    setEvents([]);
  };

  const handleRun = async () => {
    if (runningRef.current || !workerReady) return;
    runningRef.current = true;
    setIsRunning(true);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    abortRunRef.current?.();
    const runSource = currentCodeRef.current;
    writeStorage(codeStorageKey, runSource);
    debTypeRegistry.set([]);
    setTypeInfo({});
    setSelectedStructName(null);
    clearEvents();
    const result = await performCheck(runSource, true);
    if (!mountedRef.current) return;
    if (
      !result ||
      result.result !== 0 ||
      result.errors.some((e) => !e.isWarning)
    ) {
      runningRef.current = false;
      setIsRunning(false);
      return;
    }
    // The editor may have changed during compilation, but events still need
    // bindings for the exact source sent to the backend.
    displayResult(result);
    const finish = () => {
      flushEvents();
      runningRef.current = false;
      if (mountedRef.current) setIsRunning(false);
      abortRunRef.current = null;
    };
    const abort = runCode(
      runSource,
      exerciseId,
      (event) => {
        if (event.type === "correctAnswer")
          writeStorage(`exercise-completed-${exerciseId}`, "true");
        if (event.type === "guestMessage" && event.data.type === "event") {
          if (++debugEventCountRef.current > 1000) {
            ++droppedEventCountRef.current;
            if (!eventTimeoutRef.current)
              eventTimeoutRef.current = setTimeout(flushEvents, 50);
            return;
          }
        }
        pendingEventsRef.current.push(event);
        if (!eventTimeoutRef.current)
          eventTimeoutRef.current = setTimeout(flushEvents, 50);
      },
      (error) => {
        console.error("Run error:", error);
        finish();
      },
      finish,
    );

    abortRunRef.current = abort;
  };

  const handleDelete = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    removeStorage(codeStorageKey);
    setCode(starterCode);
    currentCodeRef.current = starterCode;
    clearEvents();
    void performCheck(starterCode, true);
  };

  const canRun = workerReady && !isRunning;

  const storageKey = `ebpf-party-layout`;

  const handleLayoutChange = (layout: { [key: string]: number }) => {
    writeStorage(storageKey, JSON.stringify(layout));
  };

  const handleCompileAsYouTypeChange = (checked: boolean) => {
    setCompileAsYouType(checked);
    writeStorage("ebpf-party-compile-as-you-type", String(checked));

    if (!checked && debounceTimeoutRef.current)
      clearTimeout(debounceTimeoutRef.current);
    if (checked && workerReady && !runningRef.current) {
      void performCheck(currentCodeRef.current);
    }
  };

  useEffect(() => {
    if (
      showResetConfirm &&
      resetDialogRef.current &&
      !resetDialogRef.current.open
    )
      resetDialogRef.current.showModal();
  }, [showResetConfirm]);

  return (
    <div className={styles.app}>
      {layoutReady && (
        <Group
          orientation="vertical"
          id={storageKey}
          defaultLayout={savedLayout}
          onLayoutChange={handleLayoutChange}
          style={{ height: "100%" }}
        >
          <Panel
            id="editor-panel"
            defaultSize="80%"
            minSize="33%"
            maxSize="80%"
          >
            <div className={styles.editorPanel}>
              <div className={styles.runButtonHeader}>
                <div className={styles.controlsGroup}>
                  <ControlButton
                    pressed={compileAsYouType}
                    onClick={() =>
                      handleCompileAsYouTypeChange(!compileAsYouType)
                    }
                    title="بررسی کد هنگام تایپ"
                  >
                    <Braces size={18} />
                  </ControlButton>
                  <ControlButton
                    pressed={vimMode}
                    onClick={() => {
                      const newValue = !vimMode;
                      setVimMode(newValue);
                      writeStorage("ebpf-party-vim-mode", String(newValue));
                    }}
                    title="حالت Vim"
                  >
                    <Keyboard size={18} />
                  </ControlButton>
                  <ControlButton
                    onClick={() => setShowResetConfirm(true)}
                    title="بازگرداندن کد اولیه"
                    disabled={isRunning || !workerReady}
                  >
                    <RotateCcw size={18} />
                  </ControlButton>
                </div>
                <RunButton
                  disabled={!canRun}
                  isRunning={isRunning}
                  onRun={handleRun}
                />
              </div>
              {!workerReady && (
                <p className={styles.workerStatus} role="status">
                  {workerError
                    ? "بارگذاری کامپایلر ناموفق بود. صفحه را دوباره بارگذاری کنید."
                    : "در حال آماده‌سازی کامپایلر…"}
                </p>
              )}
              <div className={styles.editorWrapper}>
                <noscript>
                  <div className="noscript-content">
                    <p>ویرایشگر تعاملی به JavaScript نیاز دارد.</p>
                    <p>می‌توانید از ویرایشگر محلی خود استفاده کنید.</p>
                    {codeFile && chapterId !== undefined && (
                      <p>
                        فایل کد:{" "}
                        <a href={`/exercises-code/${chapterId}/${codeFile}`}>
                          {codeFile}
                        </a>
                      </p>
                    )}
                    <p>رابط API:</p>
                    <pre>
                      {`POST /run_code/${exerciseId}
  - Body: your code`}
                    </pre>
                  </div>
                </noscript>
                <CodeEditor
                  code={code}
                  onChange={handleCodeChange}
                  onRun={handleRun}
                  canRun={canRun}
                  onSelectStruct={handleSelectStruct}
                  vimMode={vimMode}
                />
              </div>
              {outputClass && (
                <CompilerOutput output={output} outputClass={outputClass} />
              )}
              {Object.keys(typeInfo).length > 0 && selectedStructName && (
                <>
                  {selectedStructName && (
                    <StructViewer
                      typeInfo={typeInfo[selectedStructName]}
                      onClose={() => setSelectedStructName(null)}
                    />
                  )}
                </>
              )}
            </div>
          </Panel>

          <Separator className={styles.resizeHandle} />

          <Panel id="events-panel" defaultSize="20%" minSize="20%">
            {events.length > 0 ? (
              <EventViewer
                events={events}
                isRunning={isRunning}
                onClear={clearEvents}
                typeRegistry={typeInfo}
                droppedEvents={droppedEvents}
              />
            ) : (
              <div className={styles.emptyEventsPane}>
                {isRunning
                  ? "در حال اجرای کد…"
                  : "کد را اجرا کنید تا رویدادها در این بخش نمایش داده شوند"}
              </div>
            )}
          </Panel>
        </Group>
      )}
      {showResetConfirm && (
        <dialog
          ref={resetDialogRef}
          className={styles.confirmDialogContent}
          aria-labelledby="reset-title"
          aria-describedby="reset-description"
          onClose={() => setShowResetConfirm(false)}
        >
          <h3 id="reset-title">بازگرداندن کد اولیه؟</h3>
          <p id="reset-description">
            تغییرات شما پاک می‌شوند و کد اولیهٔ تمرین جایگزین خواهد شد.
          </p>
          <div className={styles.confirmButtons}>
            <button
              className={styles.cancelButton}
              onClick={() => setShowResetConfirm(false)}
            >
              انصراف
            </button>
            <button
              className={styles.confirmButton}
              onClick={() => {
                handleDelete();
                setShowResetConfirm(false);
              }}
            >
              بازگرداندن
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
