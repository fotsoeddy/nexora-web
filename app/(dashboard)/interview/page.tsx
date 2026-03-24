"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

type CallStatus = "idle" | "connecting" | "in-call";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function InterviewPage() {
  const { user } = useAuth();
  const vapiRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [volume, setVolume] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!;
  const assistantId = process.env.NEXT_PUBLIC_VAPI_INTAKE_ASSISTANT_ID!;

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Initialize Vapi on mount
  useEffect(() => {
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
        setVolume(0);
        if (timerRef.current) clearInterval(timerRef.current);
      });
      vapi.on("speech-start", (m: any) => {
        if (m?.role === "assistant") setAiSpeaking(true);
      });
      vapi.on("speech-end", (m: any) => {
        if (m?.role === "assistant") setAiSpeaking(false);
      });
      vapi.on("message", (message: any) => {
        if (message.type === "transcript" && message.transcriptType === "final") {
          setTranscript((prev) => [
            ...prev,
            { role: message.role, text: message.transcript },
          ]);
        }
      });
      vapi.on("volume-level", (level: number) => {
        setVolume(level);
      });
      vapi.on("error", (e: any) => {
        console.error("Vapi error:", e);
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
    setTranscript([]);
    setVolume(0);
    const vapi = vapiRef.current;

    try {
      const { AuthService } = await import("@/lib/services/authService");
      const { TokenStorage } = await import("@/lib/apiClient");
      
      let maxDurationSeconds = 60;
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
      const vapi = vapiRef.current;
      if (vapi) await vapi.stop();
    } catch {
      /* ignore */
    }
    setStatus("idle");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-1 gradient-text">Interview AI</h1>
        <p className="text-xs text-[var(--muted)]">Voice-to-Voice Simulation</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-12">
        {/* Circular Speaker UI */}
        <div className="relative flex items-center justify-center">
          {/* Pulse Rings */}
          {status === "in-call" && (
            <>
              <div 
                className="absolute w-48 h-48 md:w-64 md:h-64 rounded-full border-2 border-[var(--primary)] opacity-20"
                style={{ 
                  transform: `scale(${1 + volume * 1.5})`,
                  transition: 'transform 0.1s ease-out, opacity 0.1s ease-out',
                  opacity: 0.1 + volume * 0.5
                }}
              />
              <div 
                className="absolute w-56 h-56 md:w-72 md:h-72 rounded-full border border-[var(--primary)] opacity-10"
                style={{ 
                  transform: `scale(${1 + volume * 0.8})`,
                  transition: 'transform 0.15s ease-out'
                }}
              />
            </>
          )}

          {/* Main Circle */}
          <div
            className={`w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center transition-all duration-500 z-10 glass`}
            style={{
              background: status === "in-call" 
                ? aiSpeaking 
                  ? "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)"
                  : "var(--surface-2)"
                : "var(--surface-1)",
              boxShadow: status === "in-call" ? "var(--shadow-glow)" : "none",
              border: status === "in-call" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
            }}
          >
            {status === "in-call" ? (
              <div className="flex flex-col items-center">
                 <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mb-2" />
                 <span className="text-xs font-bold text-white uppercase tracking-widest">
                   {aiSpeaking ? "AI Speaking" : "Listening..."}
                 </span>
              </div>
            ) : (
              <svg
                width="32"
                height="32"
                className="md:w-10 md:h-10 text-[var(--primary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </div>
        </div>

        {/* Status & Timer */}
        <div className="text-center">
          {status === "connecting" && <p className="text-sm font-medium animate-pulse">Connecting to AI...</p>}
          {timeLeft !== null && status === "in-call" && (
            <div className="inline-flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono font-bold text-white">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          )}
        </div>

        {/* Transcript Area */}
        {status === "in-call" && (
          <div className="w-full max-w-lg flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--muted)]">Transcript</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-[var(--success)]" />
                <div className="w-1 h-1 rounded-full bg-[var(--success)] opacity-50" />
                <div className="w-1 h-1 rounded-full bg-[var(--success)] opacity-20" />
              </div>
            </div>
            <div 
              ref={scrollRef}
              className="glass p-4 rounded-2xl h-48 overflow-y-auto space-y-4 scroll-smooth"
              style={{ background: 'rgba(0,0,0,0.2)' }}
            >
              {transcript.length === 0 ? (
                <p className="text-center text-xs text-[var(--muted)] italic mt-4">Start speaking to see the transcript...</p>
              ) : (
                transcript.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[9px] text-[var(--muted)] mb-1 uppercase tracking-tighter">
                      {msg.role === 'user' ? (user?.first_name || 'You') : 'AI Assistant'}
                    </span>
                    <p 
                      className={`text-xs p-3 rounded-2xl max-w-[85%] ${
                        msg.role === 'user' 
                          ? 'bg-[var(--primary)] text-white' 
                          : 'bg-[var(--surface-2)] text-[var(--foreground)]'
                      }`}
                      style={{ borderRadius: msg.role === 'user' ? '18px 2px 18px 18px' : '2px 18px 18px 18px' }}
                    >
                      {msg.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Control Button */}
        <div className="flex justify-center">
          {status === "idle" ? (
            <button
              onClick={start}
              className="group relative flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-[var(--primary)] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative px-10 py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform cursor-pointer">
                Start Call
              </div>
            </button>
          ) : (
            <button
              onClick={stop}
              className="group flex flex-col items-center gap-3 transition-transform hover:scale-105 cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="4" />
                </svg>
              </div>
              <span className="text-xs font-bold text-red-500 uppercase tracking-widest">End Call</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
