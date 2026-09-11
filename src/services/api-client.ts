import { env } from "../lib/env";

/**
 * Minimal REST client for the FastAPI backend.
 *
 * The frontend reads live data through Convex subscriptions; this client is
 * the seam for operations that belong to the FastAPI service (health checks
 * today, writes and exports as the backend matures). It stays dependency-free
 * so swapping transport details never ripples into feature code.
 */

export interface HealthResponse {
  status: string;
  service?: string;
  version?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.VITE_API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new ApiError(`Request failed: ${path}`, response.status);
  }
  return (await response.json()) as T;
}

export const apiClient = {
  health: () => request<HealthResponse>("/health"),
};
