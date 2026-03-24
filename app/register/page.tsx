"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthService } from "@/lib/services/authService";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password1: "",
    password2: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password1 !== formData.password2) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await AuthService.register(formData);
      setSuccess(true);
      // Auto redirect after 5 seconds or let them click
      setTimeout(() => {
        router.push("/login");
      }, 5000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh px-4">
        <div className="w-full max-w-md animate-fade-in-up text-center">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
            style={{ background: "rgba(52, 211, 153, 0.1)", color: "var(--success)" }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
            Success! We&apos;ve sent a verification link to <strong>{formData.email}</strong>. 
            Please verify your account to start using Nexora.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            Go to Login
          </Link>
          <p className="mt-6 text-xs" style={{ color: "var(--surface-3)" }}>
            Redirecting to login in 5 seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh relative overflow-hidden px-4 py-12">
      {/* Decorative orbs */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{
          background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          top: "-10%",
          right: "-10%",
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{
          background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
          bottom: "-5%",
          left: "-5%",
        }}
      />

      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <Link href="/login" className="inline-block">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{
                background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </Link>
          <h1 className="text-3xl font-bold gradient-text">Create Account</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Join Nexora and supercharge your career
          </p>
        </div>

        {/* Register Card */}
        <div className="glass rounded-2xl p-8" style={{ borderRadius: "var(--radius-xl)" }}>
          {error && (
            <div
              className="mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
              style={{
                background: "var(--danger-bg)",
                color: "var(--danger)",
                border: "1px solid rgba(248, 113, 113, 0.2)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                  First Name
                </label>
                <input
                  id="first_name"
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="John"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--surface-3)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                  Last Name
                </label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Doe"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--surface-3)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--surface-3)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                  Password
                </label>
                <input
                  id="password1"
                  type="password"
                  required
                  value={formData.password1}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--surface-3)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                  Confirm
                </label>
                <input
                  id="password2"
                  type="password"
                  required
                  value={formData.password2}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--surface-3)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-4 rounded-xl font-semibold text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: isLoading
                  ? "var(--surface-3)"
                  : "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                boxShadow: isLoading ? "none" : "var(--shadow-glow)",
              }}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: "var(--muted)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium transition-colors hover:underline" style={{ color: "var(--primary)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
