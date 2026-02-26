import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";

export async function GET() {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  return NextResponse.json({
    user: {
      id: user._id,
      email: user.email,
    },
  });
}
