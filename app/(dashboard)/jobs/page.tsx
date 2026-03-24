"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobService, type Job } from "@/lib/services/jobService";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchJobs() {
      try {
        const data = await JobService.getJobs();
        setJobs(data);
        setFilteredJobs(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load jobs"
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchJobs();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredJobs(jobs);
      return;
    }
    const q = search.toLowerCase();
    setFilteredJobs(
      jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company_name?.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q)
      )
    );
  }, [search, jobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div
            className="spinner"
            style={{ borderTopColor: "var(--primary)" }}
          />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Loading jobs…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div
          className="glass rounded-xl px-6 py-4 text-center"
          style={{ color: "var(--danger)" }}
        >
          <p className="font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm underline cursor-pointer"
            style={{ color: "var(--primary)" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {filteredJobs.length} position{filteredJobs.length !== 1 ? "s" : ""}{" "}
            available
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: "var(--muted)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by title, company, or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 placeholder:opacity-40"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--surface-3)",
              color: "var(--foreground)",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--primary)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "var(--surface-3)")
            }
          />
        </div>
      </div>

      {/* Job Grid */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-16">
          <p style={{ color: "var(--muted)" }}>No jobs found.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="glass rounded-xl p-5 transition-all duration-200 hover:border-[var(--primary)] group block"
              style={{ borderRadius: "var(--radius-lg)" }}
            >
              {/* Company + badges */}
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--primary)",
                  }}
                >
                  {job.company_name?.[0]?.toUpperCase() || "N"}
                </div>
                {job.is_remote && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: "rgba(52, 211, 153, 0.12)",
                      color: "var(--success)",
                    }}
                  >
                    Remote
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-sm mb-1 group-hover:text-[var(--primary-hover)] transition-colors line-clamp-1">
                {job.title}
              </h3>
              <p
                className="text-xs mb-3 line-clamp-1"
                style={{ color: "var(--muted)" }}
              >
                {job.company_name || "Unknown Company"}
                {job.location ? ` · ${job.location}` : ""}
              </p>

              {/* Tags */}
              <div className="flex items-center gap-2 flex-wrap">
                {job.employment_type && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-md"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--muted)",
                    }}
                  >
                    {job.employment_type}
                  </span>
                )}
                <span
                  className="text-xs px-2 py-0.5 rounded-md"
                  style={{
                    background:
                      job.status === "active"
                        ? "rgba(99, 102, 241, 0.1)"
                        : "var(--surface-2)",
                    color:
                      job.status === "active"
                        ? "var(--primary)"
                        : "var(--muted)",
                  }}
                >
                  {job.status}
                </span>
              </div>

              {/* Date */}
              <p
                className="text-xs mt-3"
                style={{ color: "var(--surface-3)" }}
              >
                {new Date(job.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
