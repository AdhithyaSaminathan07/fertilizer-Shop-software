export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  timestamp: string;
}

export type DatabaseConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnecting"
  | "disconnected"
  | "uninitialized";

export interface HealthCheckData {
  status: "healthy" | "degraded";
  environment: string;
  database: {
    status: DatabaseConnectionStatus;
    connected: boolean;
  };
  uptime: number;
}

