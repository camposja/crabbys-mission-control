import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon }          from "@xterm/addon-fit";
import { WebLinksAddon }     from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { createConsumer }    from "@rails/actioncable";
import { Plus, X, AlertTriangle, Terminal as TermIcon } from "lucide-react";
import ErrorBoundary         from "../../components/ui/ErrorBoundary";

const CABLE_URL = import.meta.env.VITE_CABLE_URL || "ws://localhost:3000/cable";

function makeSessionId() {
  return `term-${Math.random().toString(36).slice(2, 10)}`;
}

function TerminalTab({ sessionId, onClose, isActive, onActivate }) {
  return (
    <div
      onClick={onActivate}
      className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer rounded-t transition-colors border-b-2 ${
        isActive
          ? "bg-gray-900 text-white border-orange-500"
          : "bg-gray-800 text-gray-400 hover:text-white border-transparent"
      }`}
    >
      <TermIcon size={11} />
      <span className="font-mono">{sessionId.replace("term-", "")}</span>
      <button
        onClick={e => { e.stopPropagation(); onClose(sessionId); }}
        className="text-gray-600 hover:text-red-400 transition-colors ml-1"
      >
        <X size={11} />
      </button>
    </div>
  );
}

function TerminalInstance({ sessionId, active }) {
  const containerRef = useRef(null);
  const xtermRef     = useRef(null);
  const fitRef       = useRef(null);
  const subRef       = useRef(null);
  const consumerRef  = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create xterm instance
    const term = new XTerm({
      theme: {
        background:    "#0d1117",
        foreground:    "#e6edf3",
        cursor:        "#f97316",
        selectionBackground: "#f97316/30",
        black:         "#21262d",
        red:           "#f85149",
        green:         "#3fb950",
        yellow:        "#d29922",
        blue:          "#58a6ff",
        magenta:       "#bc8cff",
        cyan:          "#39c5cf",
        white:         "#b1bac4",
        brightBlack:   "#6e7681",
        brightRed:     "#ff7b72",
        brightGreen:   "#56d364",
        brightYellow:  "#e3b341",
        brightBlue:    "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan:    "#56d4dd",
        brightWhite:   "#f0f6fc",
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize:   14,
      cursorBlink: true,
      scrollback:  2000,
    });

    const fit    = new FitAddon();
    const links  = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);
    fit.fit();

    xtermRef.current = term;
    fitRef.current   = fit;

    // Connect to Action Cable TerminalChannel
    const consumer = createConsumer(CABLE_URL);
    consumerRef.current = consumer;

    const subscription = consumer.subscriptions.create(
      { channel: "TerminalChannel", session_id: sessionId },
      {
        connected() {
          term.writeln("\x1b[32mConnected to terminal session\x1b[0m");
          term.writeln("\x1b[90m─────────────────────────────────────────────\x1b[0m");
          term.writeln("\x1b[33m⚠ This terminal runs with your local user privileges.\x1b[0m");
          term.writeln("\x1b[33m  Keep this app localhost-only.\x1b[0m");
          term.writeln("\x1b[90m─────────────────────────────────────────────\x1b[0m\r\n");
        },
        disconnected() {
          term.writeln("\r\n\x1b[31m[Disconnected]\x1b[0m");
        },
        received(data) {
          if (data.output) {
            term.write(data.output);
          }
          if (data.closed) {
            term.writeln("\r\n\x1b[90m[Session closed]\x1b[0m");
          }
        },
      }
    );
    subRef.current = subscription;

    // Send keystrokes to backend
    term.onData(data => {
      subscription.perform("input", { data, session_id: sessionId });
    });

    // Resize handler
    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
        subscription.perform("resize", {
          cols: term.cols,
          rows: term.rows,
          session_id: sessionId,
        });
      } catch {}
    });
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      subscription.unsubscribe();
      consumer.disconnect();
      term.dispose();
    };
  }, [sessionId]);

  // Show/hide based on active tab (keep xterm mounted to preserve state)
  useEffect(() => {
    if (active && fitRef.current) {
      setTimeout(() => fitRef.current?.fit(), 50);
    }
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ display: active ? "block" : "none", minHeight: "400px" }}
    />
  );
}

function TerminalInner() {
  const [sessions, setSessions] = useState(() => [makeSessionId()]);
  const [active,   setActive]   = useState(() => sessions[0]);

  function addTab() {
    if (sessions.length >= 8) return;
    const id = makeSessionId();
    setSessions(prev => [...prev, id]);
    setActive(id);
  }

  function closeTab(id) {
    setSessions(prev => {
      const next = prev.filter(s => s !== id);
      if (active === id && next.length > 0) setActive(next[next.length - 1]);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]" style={{ minHeight: "600px" }}>
      {/* Security notice bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-xs text-yellow-400 shrink-0">
        <AlertTriangle size={12} />
        Local terminal — keep this app on localhost only. Never expose to the internet.
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 pt-2 bg-gray-950 border-b border-gray-800 shrink-0">
        {sessions.map(id => (
          <TerminalTab
            key={id}
            sessionId={id}
            isActive={id === active}
            onActivate={() => setActive(id)}
            onClose={closeTab}
          />
        ))}
        <button
          onClick={addTab}
          disabled={sessions.length >= 8}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-white px-2 py-1.5 transition-colors disabled:opacity-30"
          title="New terminal tab"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Terminal panels (all mounted, only active is visible) */}
      <div className="flex-1 p-2 overflow-hidden">
        {sessions.map(id => (
          <TerminalInstance key={id} sessionId={id} active={id === active} />
        ))}
      </div>
    </div>
  );
}

export default function TerminalPage() {
  return (
    <ErrorBoundary>
      <TerminalInner />
    </ErrorBoundary>
  );
}
