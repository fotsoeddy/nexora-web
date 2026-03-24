import { ApiService } from "../apiService";

/* ─── Types ─── */

export interface Job {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  employment_type: string | null;
  description: string;
  requirements: string | null;
  responsibilities: string;
  salary_min: number | null;
  salary_max: number | null;
  is_remote: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

/* ─── Job Service ─── */

export const JobService = {
  async getJobs(): Promise<Job[]> {
    return ApiService.get<Job[]>("/ai/api/jobs/");
  },

  async getJob(id: string): Promise<Job> {
    return ApiService.get<Job>(`/ai/api/jobs/${id}/`);
  },
};
