"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace("/jobs");
      } else {
        router.replace("/login");
      }
    }
  }, [user, isLoading, router]);

  // Show a minimal loading state while determining auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh">
      <div className="flex flex-col items-center gap-4 animate-fade-in-up">
        <div
          className="w-12 h-12 rounded-xl pulse-glow flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="spinner" style={{ borderTopColor: "var(--primary)" }} />
      </div>
    </div>
  );
}
