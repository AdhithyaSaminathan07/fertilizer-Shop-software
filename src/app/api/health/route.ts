import type { NextResponse } from "next/server";
import { connectDB, getDatabaseStatus, isDatabaseConnected } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { successResponse } from "@/lib/api-response";
import type { HealthCheckData } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const env = getEnv();

  // Attempt connection safely if not already connected
  if (!isDatabaseConnected()) {
    try {
      await connectDB();
    } catch {
      // Gracefully handle: status will safely reflect actual state without leaking credentials
    }
  }

  const dbConnected = isDatabaseConnected();
  const dbStatus = getDatabaseStatus();

  const healthData: HealthCheckData = {
    status: dbConnected ? "healthy" : "degraded",
    environment: env.NODE_ENV,
    database: {
      status: dbStatus,
      connected: dbConnected,
    },
    uptime: process.uptime(),
  };

  return successResponse(healthData);
}

