import { ApiService } from "../apiService";

/* ─── Types ─── */

export interface InterviewSessionRequest {
  job_id: string;
  interview_type: "behavioral" | "technical" | "mixed";
  question_count: number;
  candidate_name?: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
}

export interface InterviewSessionResponse {
  session_id: string;
  questions: InterviewQuestion[];
  job_title?: string;
}

/* ─── Interview Service ─── */

export const InterviewService = {
  async generateSession(
    params: InterviewSessionRequest
  ): Promise<InterviewSessionResponse> {
    return ApiService.post<InterviewSessionResponse, InterviewSessionRequest>(
      "/ai/api/interviews/sessions/generate/",
      params
    );
  },
};
