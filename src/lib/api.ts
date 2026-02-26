import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { UserModel } from "@/models/User";

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser() {
  await connectToDatabase();
  const session = await getSession();
  if (!session) {
    return { error: errorResponse("Unauthorized", 401), user: null };
  }

  const user = await UserModel.findById(session.userId);
  if (!user) {
    return { error: errorResponse("Unauthorized", 401), user: null };
  }

  return { error: null, user };
}

export function parseBody<T>(body: unknown, validator: (value: unknown) => T) {
  try {
    return { data: validator(body), error: null as NextResponse | null };
  } catch {
    return { data: null, error: errorResponse("Invalid request body", 400) };
  }
}
