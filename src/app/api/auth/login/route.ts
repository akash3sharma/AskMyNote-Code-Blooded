import { z } from "zod";
import { NextResponse } from "next/server";

import { comparePassword, setAuthCookie, signSessionToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { UserModel } from "@/models/User";

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  await connectToDatabase();

  const user = await UserModel.findOne({ email: parsed.data.email });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const validPassword = await comparePassword(parsed.data.password, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signSessionToken({
    userId: user._id.toString(),
    email: user.email,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user._id,
      email: user.email,
    },
  });

  setAuthCookie(response, token);
  return response;
}
