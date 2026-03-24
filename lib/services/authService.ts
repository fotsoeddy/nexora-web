/* ─── Type definitions ─── */

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_email_verified: boolean;
  is_staff: boolean;
  interview_limit_mins: number;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RegisterPayload {
  email: string;
  first_name: string;
  last_name?: string;
  password1: string;
  password2: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
  message: string;
}

export interface UserConfig {
  max_duration_seconds: number;
  end_call_message: string;
}

/* ─── Auth Service ─── */

import { API_CONFIG } from "../apiClient";

const BASE = API_CONFIG.BASE_URL;

export const AuthService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${BASE}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg =
        data?.detail ||
        data?.message ||
        (typeof data === "object"
          ? Object.values(data).flat().join(", ")
          : "Login failed");
      throw new Error(msg);
    }

    return data as LoginResponse;
  },

  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    const res = await fetch(`${BASE}/api/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg =
        data?.detail ||
        data?.message ||
        (typeof data === "object"
          ? Object.values(data).flat().join(", ")
          : "Registration failed");
      throw new Error(msg);
    }

    return data as RegisterResponse;
  },

  async getMe(accessToken: string): Promise<User> {
    const res = await fetch(`${BASE}/api/auth/me/`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  },

  async refreshToken(
    refreshToken: string
  ): Promise<{ access: string; refresh?: string }> {
    const res = await fetch(`${BASE}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!res.ok) throw new Error("Token refresh failed");
    return res.json();
  },

  async getUserConfig(accessToken: string): Promise<UserConfig> {
    const res = await fetch(`${BASE}/api/auth/config/`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) throw new Error("Failed to fetch user config");
    return res.json();
  },
};
