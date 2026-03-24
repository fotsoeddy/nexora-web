"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { JobService, type Job } from "@/lib/services/jobService";
import { InterviewService } from "@/lib/services/interviewService";
import { useAuth } from "@/lib/auth/AuthContext";

type InterviewStatus =
  | "idle"
  | "generating"
  | "connecting"
  | "in-call";

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Interview state
  const [interviewStatus, setInterviewStatus] =
    useState<InterviewStatus>("idle");
  const [interviewType, setInterviewType] = useState<
    "behavioral" | "technical" | "mixed"
  >("mixed");
  const [questionCount, setQuestionCount] = useState(5);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const vapiRef = useRef<unknown>(null);

  useEffect(() => {
    async function fetchJob() {
      try {
        const data = await JobService.getJob(jobId);
        setJob(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load job"
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchJob();
  }, [jobId]);

  // Initialize Vapi only when needed (lazy loaded)
  const initVapi = async () => {
    if (vapiRef.current) return vapiRef.current;

    const { default: Vapi } = await import("@vapi-ai/web");
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!;
    const vapi = new Vapi(publicKey);

    vapi.on("call-start", () => setInterviewStatus("in-call"));
    vapi.on("call-end", () => {
      setInterviewStatus("idle");
      setTimeLeft(null);
      if (timerRef.current) clearInterval(timerRef.current);
    });
    vapi.on("error", (e: unknown) => {
      console.error("Vapi error:", e);
      setInterviewStatus("idle");
      setTimeLeft(null);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    vapiRef.current = vapi;
    return vapi;
  };

  const startInterview = async () => {
    if (!job) return;

    try {
      setInterviewStatus("generating");

      // 1. Generate session + questions via backend
      const data = await InterviewService.generateSession({
        job_id: jobId,
        interview_type: interviewType,
        question_count: questionCount,
        candidate_name:
          user?.first_name && user?.last_name
            ? `${user.first_name} ${user.last_name}`
            : user?.first_name || "Candidate",
      });

      // 2. Start Vapi Interviewer assistant
      setInterviewStatus("connecting");
      const vapi = (await initVapi()) as {
        start: (id: string, opts: Record<string, unknown>) => Promise<void>;
      };

      const assistantId =
        process.env.NEXT_PUBLIC_VAPI_INTERVIEWER_ASSISTANT_ID!;

      const sessionId = (data as any).session_id || (data as any).id;

      await vapi.start(assistantId, {
        maxDurationSeconds: (data as any).max_duration_seconds || 60,
        variableValues: {
          candidateName:
            user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : user?.first_name || "Candidate",
          sessionId,
          session_id: sessionId, // alias
          questionsJson: JSON.stringify(data.questions),
          questions_json: JSON.stringify(data.questions), // alias
          jobTitle: job.title,
          jobId,
          interviewType,
          questionCount: String(questionCount),
          endCallMessage: (data as any).end_call_message,
        },
      });

      // Start Countdown
      const maxSeconds = (data as any).max_duration_seconds || 60;
      setTimeLeft(maxSeconds);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } catch (err: unknown) {
      console.error(err);
      setInterviewStatus("idle");
      if (timerRef.current) clearInterval(timerRef.current);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to start interview"
      );
    }
  };

  const stopInterview = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(null);
      const vapi = vapiRef.current as {
        stop: () => Promise<void>;
      } | null;
      if (vapi) await vapi.stop();
    } catch {
      /* ignore */
    }
    setInterviewStatus("idle");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div
          className="spinner"
          style={{ borderTopColor: "var(--primary)" }}
        />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <p className="font-medium" style={{ color: "var(--danger)" }}>
            {error || "Job not found"}
          </p>
          <button
            onClick={() => router.push("/jobs")}
            className="mt-3 text-sm underline cursor-pointer"
            style={{ color: "var(--primary)" }}
          >
            Back to jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Back button */}
      <button
        onClick={() => router.push("/jobs")}
        className="flex items-center gap-2 text-sm mb-6 transition-colors cursor-pointer hover:underline"
        style={{ color: "var(--muted)" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to jobs
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div
            className="glass rounded-xl p-6"
            style={{ borderRadius: "var(--radius-lg)" }}
          >
            <div className="flex items-start gap-4 mb-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--primary)",
                }}
              >
                {job.company_name?.[0]?.toUpperCase() || "N"}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold mb-1">{job.title}</h1>
                <p style={{ color: "var(--muted)" }}>
                  {job.company_name || "Unknown Company"}
                  {job.location ? ` · ${job.location}` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {job.employment_type && (
                <span
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--foreground)",
                  }}
                >
                  {job.employment_type}
                </span>
              )}
              {job.is_remote && (
                <span
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{
                    background: "rgba(52, 211, 153, 0.12)",
                    color: "var(--success)",
                  }}
                >
                  Remote
                </span>
              )}
              <span
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{
                  background: "rgba(99, 102, 241, 0.1)",
                  color: "var(--primary)",
                }}
              >
                {job.status}
              </span>
            </div>
          </div>

          {/* Description */}
          <div
            className="glass rounded-xl p-6"
            style={{ borderRadius: "var(--radius-lg)" }}
          >
            <h2 className="text-lg font-semibold mb-3">Description</h2>
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--muted)" }}
            >
              {job.description}
            </div>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div
              className="glass rounded-xl p-6"
              style={{ borderRadius: "var(--radius-lg)" }}
            >
              <h2 className="text-lg font-semibold mb-3">Requirements</h2>
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--muted)" }}
              >
                {job.requirements}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — Interview */}
        <div className="lg:col-span-1">
          <div
            className="glass rounded-xl p-6 sticky top-8"
            style={{ borderRadius: "var(--radius-lg)" }}
          >
            <h2 className="text-lg font-semibold mb-1">
              AI Mock Interview
            </h2>
            <p
              className="text-xs mb-5"
              style={{ color: "var(--muted)" }}
            >
              Practice with an AI interviewer for this role
            </p>

            {/* Interview config */}
            <div className="space-y-3 mb-5">
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--muted)" }}
                >
                  Interview type
                </label>
                <select
                  value={interviewType}
                  onChange={(e) =>
                    setInterviewType(
                      e.target.value as "behavioral" | "technical" | "mixed"
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--surface-3)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="mixed">Mixed</option>
                  <option value="technical">Technical</option>
                  <option value="behavioral">Behavioral</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--muted)" }}
                >
                  Number of questions
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={questionCount}
                  onChange={(e) =>
                    setQuestionCount(Number(e.target.value))
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--surface-3)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <button
              onClick={startInterview}
              disabled={interviewStatus !== "idle"}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-2"
              style={{
                background:
                  interviewStatus !== "idle"
                    ? "var(--surface-3)"
                    : "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                boxShadow:
                  interviewStatus === "idle"
                    ? "var(--shadow-glow)"
                    : "none",
              }}
            >
              {interviewStatus === "generating"
                ? "Generating…"
                : interviewStatus === "connecting"
                  ? "Connecting…"
                  : interviewStatus === "in-call"
                    ? "In call"
                    : "Start Interview"}
            </button>

            {interviewStatus !== "idle" && (
              <button
                onClick={stopInterview}
                className="w-full py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                style={{
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  border: "1px solid rgba(248, 113, 113, 0.2)",
                }}
              >
                End Interview
              </button>
            )}

            {interviewStatus === "in-call" && (
              <div
                className="mt-4 flex flex-col gap-2 py-2 px-3 rounded-lg"
                style={{
                  background: "rgba(52, 211, 153, 0.1)",
                }}
              >
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--success)" }}>
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{
                      background: "var(--success)",
                      animation: "pulseGlow 1.5s ease-in-out infinite",
                    }}
                  />
                  Interview in progress…
                </div>
                
                {timeLeft !== null && (
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1" style={{ color: "var(--success)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")} remaining
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
