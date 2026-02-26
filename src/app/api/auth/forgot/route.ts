import { z } from "zod";
import { NextResponse } from "next/server";

const forgotSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = forgotSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a valid email" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "If this email exists, a reset instruction was sent.",
  });
}
