import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { nanoid } from "nanoid";

import { env } from "@/lib/env";

function resolveUploadDirectory() {
  return path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.join(process.cwd(), env.UPLOAD_DIR);
}

export async function ensureUploadDirectory() {
  const dir = resolveUploadDirectory();
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function saveUpload(file: File) {
  const dir = await ensureUploadDirectory();
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const generatedName = `${Date.now()}_${nanoid(8)}_${sanitizedName}`;
  const targetPath = path.join(dir, generatedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(targetPath, buffer);

  return {
    path: targetPath,
    size: buffer.length,
    mimeType: file.type || "application/octet-stream",
    extension: extension?.toLowerCase() || "bin",
    originalName: file.name,
    buffer,
  };
}
