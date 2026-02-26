import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { failFileIngestion, ingestFile } from "@/lib/ingest";
import { saveUpload } from "@/lib/storage";
import { SubjectModel } from "@/models/Subject";
import { NoteFileModel } from "@/models/NoteFile";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const { id } = await context.params;
  const subject = await SubjectModel.findOne({ _id: id, userId: user._id });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const files = await NoteFileModel.find({ userId: user._id, subjectId: subject._id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    files: files.map((file) => ({
      id: file._id,
      fileName: file.fileName,
      parseStatus: file.parseStatus,
      sectionsCount: file.sectionsCount,
      chunksCount: file.chunksCount,
      errorMessage: file.errorMessage,
      createdAt: file.createdAt,
    })),
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const { id } = await context.params;
  const subject = await SubjectModel.findOne({ _id: id, userId: user._id });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const maybeFile = formData.get("file");

  if (!(maybeFile instanceof File)) {
    return NextResponse.json({ error: "Please attach a file" }, { status: 400 });
  }

  const saved = await saveUpload(maybeFile);

  const fileDoc = await NoteFileModel.create({
    userId: user._id,
    subjectId: subject._id,
    fileName: saved.originalName,
    mimeType: saved.mimeType,
    size: saved.size,
    storagePath: saved.path,
    parseStatus: "processing",
  });

  try {
    const ingested = await ingestFile({
      userId: user._id.toString(),
      subjectId: subject._id.toString(),
      fileId: fileDoc._id.toString(),
      fileName: saved.originalName,
      mimeType: saved.mimeType,
      extension: saved.extension,
      buffer: saved.buffer,
    });

    return NextResponse.json({
      file: {
        id: fileDoc._id,
        fileName: saved.originalName,
        parseStatus: "parsed",
        sectionsCount: ingested.sectionsCount,
        chunksCount: ingested.chunksCount,
      },
    });
  } catch (uploadError) {
    const message = uploadError instanceof Error ? uploadError.message : "Parsing failed";
    await failFileIngestion(fileDoc._id.toString(), message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
