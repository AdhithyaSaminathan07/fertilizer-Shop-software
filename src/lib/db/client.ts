import mongoose from "mongoose";
import { getRuntimeDatabaseUri } from "@/lib/env";
import type { DatabaseConnectionStatus } from "@/types";

interface MongooseConnectionCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseConnectionCache | undefined;
}

let cached: MongooseConnectionCache = globalThis.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached;
}

export function getDatabaseStatus(): DatabaseConnectionStatus {
  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    case 0:
      return "disconnected";
    default:
      return "uninitialized";
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Connect to MongoDB with safe singleton caching across App Router reloads.
 * Catches connection errors safely without exposing credentials.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const uri = getRuntimeDatabaseUri();
  if (!uri) {
    throw new Error("Database URI is not configured");
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose
      .connect(uri, opts)
      .then((mongooseInstance) => {
        return mongooseInstance;
      })
      .catch((error) => {
        // Reset cached promise on failure to allow subsequent retries
        cached.promise = null;
        // Never log or re-throw connection strings or credentials
        const safeErrorMessage =
          error instanceof Error ? error.message : "Unknown database connection failure";
        console.error("Database connection failed:", safeErrorMessage);
        throw new Error("Unable to establish database connection");
      });
  }

  try {
    cached.conn = await cached.promise;
    
    // Strict Staging Isolation Guard: Ensure active database is strictly 'kasi_staging' when APP_ENV=staging
    const isStaging = process.env.APP_ENV === "staging";
    const currentDb = mongoose.connection.db?.databaseName;
    if (isStaging && currentDb !== "kasi_staging") {
      await mongoose.disconnect();
      cached.conn = null;
      cached.promise = null;
      throw new Error(
        `FATAL DATABASE GUARD: Staging environment attempted connection to '${currentDb}' instead of 'kasi_staging'. Connection immediately terminated.`
      );
    }
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
