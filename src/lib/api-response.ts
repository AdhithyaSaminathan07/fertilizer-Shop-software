import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";
import { HTTP_STATUS, type HttpStatusCode } from "@/constants/http-status";

export function successResponse<T>(
  data: T,
  status: HttpStatusCode = HTTP_STATUS.OK
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function errorResponse(
  message: string,
  status: HttpStatusCode = HTTP_STATUS.BAD_REQUEST,
  details: unknown = null
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details !== null && details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

