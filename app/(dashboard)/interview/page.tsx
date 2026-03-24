"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

type CallStatus = "idle" | "connecting" | "in-call";

export default function InterviewPage() {
  const { user } = useAuth();
  const vapiRef = useRef<unknown>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!;
  const assistantId = process.env.NEXT_PUBLIC_VAPI_INTAKE_ASSISTANT_ID!;

  // Initialize Vapi on mount
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vapi: any;

    async function init() {
      const { default: Vapi } = await import("@vapi-ai/web");
      vapi = new Vapi(publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setStatus("in-call");
      });
      vapi.on("call-end", () => {
        setStatus("idle");
        setAiSpeaking(false);
        setTimeLeft(null);
        if (timerRef.current) clearInterval(timerRef.current);
      });
      vapi.on("speech-start", (m: any) => {
        if (m?.role === "assistant") setAiSpeaking(true);
      });
      vapi.on("speech-end", (m: any) => {
        if (m?.role === "assistant") setAiSpeaking(false);
      });
      vapi.on("error", (e: any) => {
        console.error("Vapi error:", e);
        console.error("Vapi error FULL:", e);
        setStatus("idle");
        setAiSpeaking(false);
      });
    }

    init();

    return () => {
      try {
        vapi?.stop();
      } catch {
        /* ignore */
      }
    };
  }, [publicKey]);

  const start = async () => {
    setStatus("connecting");
    const vapi = vapiRef.current as {
      start: (id: string, opts: Record<string, unknown>) => Promise<void>;
    };

    try {
      // 1. Fetch user limits & config
      const { AuthService } = await import("@/lib/services/authService");
      const { TokenStorage } = await import("@/lib/apiClient");
      
      let maxDurationSeconds = 60; // Default fallback
      let endCallMessage = "";
      
      const token = TokenStorage.getAccessToken();
      if (token) {
        try {
          const config = await AuthService.getUserConfig(token);
          maxDurationSeconds = config.max_duration_seconds;
          endCallMessage = config.end_call_message;
        } catch (e) {
          console.error("Failed to fetch user config:", e);
        }
      }

      // 2. Start call
      setTimeLeft(maxDurationSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);

      await vapi.start(assistantId, {
        maxDurationSeconds,
        variableValues: {
          candidateName:
            user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : user?.first_name || "Candidate",
          endCallMessage,
        },
      });
    } catch (err) {
      console.error("Call start failed:", err);
      setStatus("idle");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const stop = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(null);
      const vapi = vapiRef.current as { stop: () => Promise<void> } | null;
      if (vapi) await vapi.stop();
    } catch {
      /* ignore */
    }
    setStatus("idle");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Voice Interview</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
        Start a voice-guided interview with our AI assistant
      </p>

      <div
        className="glass rounded-xl p-5 md:p-8 max-w-lg mx-auto text-center"
        style={{ borderRadius: "var(--radius-xl)" }}
      >
        <div className="flex items-center justify-center mb-6">
          <div
            className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center transition-all duration-500"
            style={{
              background:
                status === "in-call"
                  ? aiSpeaking
                    ? "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)"
                    : "linear-gradient(135deg, var(--primary) 0%, var(--success) 100%)"
                  : "var(--surface-2)",
              boxShadow:
                status === "in-call"
                  ? "0 0 60px var(--primary-glow)"
                  : "none",
              animation:
                status === "in-call" && aiSpeaking
                  ? "pulseGlow 1.5s ease-in-out infinite"
                  : "none",
            }}
          >
            <svg
              width="32"
              height="32"
              className="md:w-10 md:h-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
        </div>

        {/* Status text */}
        <p className="text-sm font-medium mb-1">
          {status === "idle"
            ? "Ready to begin"
            : status === "connecting"
              ? "Connecting…"
              : aiSpeaking
                ? "AI is speaking"
                : "Listening to you"}
        </p>
        
        {timeLeft !== null && status === "in-call" && (
          <div className="flex items-center justify-center mb-2">
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")} remaining
            </div>
          </div>
        )}

        <p className="text-xs mb-6" style={{ color: "var(--muted)" }}>
          {status === "idle"
            ? "Click the button below to start your interview"
            : status === "in-call"
              ? "Speak naturally — the AI will guide you through the interview"
              : "Setting up your interview session…"}
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={start}
            disabled={status !== "idle"}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:
                status !== "idle"
                  ? "var(--surface-3)"
                  : "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
              boxShadow:
                status === "idle" ? "var(--shadow-glow)" : "none",
            }}
          >
            {status === "connecting" ? (
              <>
                <span className="spinner" />
                Connecting…
              </>
            ) : (
              "Start Interview"
            )}
          </button>

          {status !== "idle" && (
            <button
              onClick={stop}
              className="px-6 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer"
              style={{
                background: "var(--danger-bg)",
                color: "var(--danger)",
                border: "1px solid rgba(248, 113, 113, 0.2)",
              }}
            >
              End
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
