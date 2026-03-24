"use client";

import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useSearchParams } from "next/navigation";
import { LuMic, LuMicOff, LuVolume2, LuVolumeX, LuX, LuPhoneCall, LuEllipsis } from "react-icons/lu";

type CallStatus = "idle" | "connecting" | "in-call";

interface Message {
  role: "user" | "assistant";
  text: string;
}

function InterviewContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  
  const vapiRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [status, setStatus] = useState<CallStatus>("idle");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [volume, setVolume] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Search Params
  const sessionId = searchParams.get("sessionId");
  const jobId = searchParams.get("jobId");
  const targetRole = searchParams.get("targetRole");
  const difficulty = searchParams.get("difficulty") || "medium";
  const count = searchParams.get("count") || "5";
  const interviewType = searchParams.get("interviewType") || "mixed";
  const assistantIdParam = searchParams.get("assistantId");
  const questionsJson = searchParams.get("questionsJson");

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "566f25e7-5fba-481e-9742-d34a961c61c8";
  const assistantId = assistantIdParam || process.env.NEXT_PUBLIC_VAPI_INTAKE_ASSISTANT_ID || "d793cfcc-8165-4ef2-8937-16772c001e96";

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

      // Fetch initial config for time limits
      const { AuthService } = await import("@/lib/services/authService");
      const { TokenStorage } = await import("@/lib/apiClient");
      const token = TokenStorage.getAccessToken();
      if (token) {
        AuthService.getUserConfig(token).then(config => {
          if (config.max_duration_seconds) setTimeLeft(config.max_duration_seconds);
        }).catch(err => console.error("Initial config fetch failed:", err));
      }

      vapi.on("call-start", () => {
        setStatus("in-call");
      });
      vapi.on("call-end", () => {
        setStatus("idle");
        setAiSpeaking(false);
        setVolume(0);
        if (timerRef.current) clearInterval(timerRef.current);
        
        // Refresh time left after call ends
        if (token) {
           AuthService.getUserConfig(token).then(config => {
             if (config.max_duration_seconds) setTimeLeft(config.max_duration_seconds);
           });
        }
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
      
      let maxDurationSeconds = 600; // 10 minutes default for web sessions
      let endCallMessage = "";
      
      const token = TokenStorage.getAccessToken();
      if (token) {
        try {
          const config = await AuthService.getUserConfig(token);
          maxDurationSeconds = config.max_duration_seconds || 600;
          endCallMessage = config.end_call_message || "Interview completed. Thank you.";
        } catch (e) {
          console.error("Failed to fetch user config:", e);
        }
      }

      setTimeLeft(maxDurationSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);

      const candidateName = user?.first_name 
        ? `${user.first_name} ${user.last_name || ""}`.trim() 
        : user?.username || "Candidate";

      await vapi.start(assistantId, {
        maxDurationSeconds,
        variableValues: {
          candidateName,
          jobTitle: targetRole || "General Role",
          difficulty,
          jobId: jobId || "",
          interviewType,
          questionCount: count,
          sessionId: sessionId || "",
          session_id: sessionId || "", // alias
          questionsJson: questionsJson || "",
          questions_json: questionsJson || "", // alias
          endCallMessage,
          userId: user?.id, // CRITICAL: Link session to user for time tracking
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

  const toggleMute = () => {
    const vapi = vapiRef.current;
    if (vapi) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      vapi.setMuted(newMuted);
    }
  };

  const currentJobTitle = targetRole || "AI Intake Session";

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-5xl mx-auto px-4">
      {/* Premium Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text pb-1">Nexora Voice</h1>
          <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-[0.2em]">High Fidelity AI Recruiter</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${status === 'in-call' ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--muted)]'}`} />
          <span className="text-[10px] uppercase font-black tracking-widest text-[var(--muted)]">
            {status === "in-call" ? "Live Session" : "Standby"}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-16">
        {/* Central visualizer Container */}
        <div className="relative flex items-center justify-center w-full">
          {/* Reactive Rings */}
          {status === "in-call" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div 
                className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full border-2 border-[var(--primary)] transition-all duration-75 ease-out"
                style={{ 
                  transform: `scale(${1 + volume * 1.8})`,
                  opacity: 0.1 + volume * 0.4
                }}
              />
              <div 
                className="absolute w-72 h-72 md:w-96 md:h-96 rounded-full border border-[var(--primary)] transition-all duration-150 ease-out"
                style={{ 
                  transform: `scale(${1 + volume * 0.9})`,
                  opacity: 0.05 + volume * 0.2
                }}
              />
            </div>
          )}

          {/* Main Visualizer Orb */}
          <div
            className={`relative group w-40 h-40 md:w-56 md:h-56 rounded-full flex flex-col items-center justify-center transition-all duration-500 z-10 glass overflow-hidden`}
            style={{
              background: status === "in-call" 
                ? aiSpeaking 
                  ? "radial-gradient(circle at center, var(--primary) 0%, rgba(0,0,0,0.8) 100%)"
                  : "rgba(255,255,255,0.03)"
                : "rgba(255,255,255,0.02)",
              boxShadow: status === "in-call" && aiSpeaking ? "0 0 50px var(--primary-opacity)" : "none",
              border: status === "in-call" ? "2px solid var(--primary)" : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {status === "in-call" ? (
              <div className="flex flex-col items-center pointer-events-none">
                 <div className={`mb-3 transition-transform duration-100 ${aiSpeaking ? 'scale-125' : 'scale-100'}`}>
                    <LuMic size={32} className={aiSpeaking ? "text-white" : "text-[var(--primary)]"} />
                 </div>
                 <div className="flex items-center gap-1.5 h-4">
                    {aiSpeaking ? (
                      <div className="flex gap-1 items-end h-3">
                        <div className="w-1 bg-white animate-audio-bar-1" />
                        <div className="w-1 bg-white animate-audio-bar-2" />
                        <div className="w-1 bg-white animate-audio-bar-3" />
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Listening</span>
                    )}
                 </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                 <LuPhoneCall size={40} className="text-[var(--primary)] mb-4 opacity-50" />
                 <LuEllipsis size={24} className="text-[var(--muted)] animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* Info & Transcript Area */}
        <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          
          {/* Left Side: Call Info / Start Card */}
          <div className="glass p-8 rounded-[32px] border border-white/5 flex flex-col justify-center">
            <div className="mb-6">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)] mb-2 block">Interview Target</span>
              <h2 className="text-2xl font-bold text-white">{currentJobTitle}</h2>
              <p className="text-sm text-[var(--muted)] mt-1">{interviewType.toUpperCase()} MODE • {difficulty.toUpperCase()} LEVEL</p>
            </div>

            {(status === "idle" || status === "connecting") && (
              <>
                <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/10 flex items-center justify-between">
                   <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black text-[var(--muted)] mb-1">Total Balance</span>
                      <span className="text-sm font-mono text-white">
                        {timeLeft !== null ? `${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s` : 'Calculating...'}
                      </span>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-[var(--primary)]/20 flex items-center justify-center">
                      <LuVolume2 size={16} className="text-[var(--primary)]" />
                   </div>
                </div>

                <button
                  onClick={start}
                  disabled={status === "connecting"}
                  className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-[var(--primary)] hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {status === "connecting" ? "Initializing..." : "Establish Connection"}
                </button>
              </>
            )}

            {status === "in-call" && (
              <div className="space-y-6">
                 {timeLeft !== null && (
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)] mb-2">Duration Remaining</span>
                      <div className="flex items-center gap-3">
                         <div className="text-3xl font-mono font-black text-white">
                           {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                         </div>
                         <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-red-500 transition-all duration-1000" 
                              style={{ width: `${(timeLeft / 600) * 100}%` }} 
                            />
                         </div>
                      </div>
                    </div>
                 )}
                 <div className="flex gap-4">
                    <button 
                      onClick={toggleMute}
                      className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl transition-all ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500' : 'bg-white/5 text-white border border-white/10'}`}
                    >
                       {isMuted ? <LuMicOff size={20} /> : <LuMic size={20} />}
                       <span className="text-[9px] uppercase font-bold mt-2">{isMuted ? 'Unmute' : 'Mute'}</span>
                    </button>
                    <button 
                      className="flex-1 flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 text-white border border-white/10"
                    >
                       <LuVolume2 size={20} />
                       <span className="text-[9px] uppercase font-bold mt-2">Speaker</span>
                    </button>
                 </div>
                 <button 
                  onClick={stop}
                  className="w-full py-4 bg-red-500 text-white font-black uppercase tracking-widest text-sm rounded-2xl flex items-center justify-center gap-3 group"
                 >
                    <LuX size={18} className="group-hover:rotate-90 transition-transform" />
                    Terminate Connection
                 </button>
              </div>
            )}
          </div>

          {/* Right Side: Transcript */}
          <div className="glass p-6 rounded-[32px] border border-white/5 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-4 px-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-[var(--muted)]">Real-time Transcript</span>
              <div className="flex gap-1.5">
                <div className={`w-1 h-1 rounded-full ${status === 'in-call' ? 'bg-[var(--success)] animate-ping' : 'bg-white/10'}`} />
              </div>
            </div>
            
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar"
            >
              {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
                  < LuVolumeX size={32} className="mb-4" />
                  <p className="text-[10px] uppercase font-bold leading-relaxed px-8">Feed currently silent. Transcript will populate as you converse.</p>
                </div>
              ) : (
                transcript.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                       <span className={`text-[8px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-[var(--primary)]' : 'text-[var(--accent)]'}`}>
                          {msg.role === 'user' ? (user?.first_name || 'CANDIDATE') : 'AI ASSISTANT'}
                       </span>
                    </div>
                    <p 
                      className={`text-xs p-3 rounded-2xl max-w-[90%] leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-[var(--primary)] text-white' 
                          : 'bg-white/5 text-white border border-white/10'
                      }`}
                      style={{ borderRadius: msg.role === 'user' ? '16px 2px 16px 16px' : '2px 16px 16px 16px' }}
                    >
                      {msg.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[#0A0A0B]"><LuEllipsis className="text-white animate-pulse" size={48} /></div>}>
      <InterviewContent />
    </Suspense>
  );
}
