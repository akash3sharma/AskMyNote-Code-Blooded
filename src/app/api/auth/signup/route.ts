import { z } from "zod";
import { NextResponse } from "next/server";

import { hashPassword, setAuthCookie, signSessionToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { UserModel } from "@/models/User";

const signupSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[a-z]/, "Password must include at least one lowercase letter")
    .regex(/[0-9]/, "Password must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol"),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await UserModel.findOne({ email: parsed.data.email });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const createdUser = await UserModel.create({
    email: parsed.data.email,
    passwordHash,
  });

  const token = await signSessionToken({
    userId: createdUser._id.toString(),
    email: createdUser.email,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: createdUser._id,
      email: createdUser.email,
    },
  });

  setAuthCookie(response, token);
  return response;
}
