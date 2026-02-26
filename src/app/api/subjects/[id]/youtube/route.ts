import { z } from "zod";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { failFileIngestion, ingestSections } from "@/lib/ingest";
import { fetchYoutubeTranscriptAsSections } from "@/lib/youtube";
import { SubjectModel } from "@/models/Subject";
import { NoteFileModel } from "@/models/NoteFile";

const youtubeSchema = z.object({
  url: z.string().trim().min(5).max(400),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const payload = await request.json().catch(() => null);
  const parsed = youtubeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a valid YouTube URL." }, { status: 400 });
  }

  const { id } = await context.params;
  const subject = await SubjectModel.findOne({ _id: id, userId: user._id });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const transcript = await fetchYoutubeTranscriptAsSections(parsed.data.url).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "Failed to fetch YouTube transcript.";
    return { error: message };
  });

  if ("error" in transcript) {
    return NextResponse.json({ error: transcript.error }, { status: 400 });
  }

  const fileName = `${transcript.title}.youtube.txt`;
  const fileDoc = await NoteFileModel.create({
    userId: user._id,
    subjectId: subject._id,
    fileName,
    mimeType: "text/youtube",
    size: transcript.totalChars,
    storagePath: `youtube:${transcript.videoId}`,
    parseStatus: "processing",
  });

  try {
    const ingested = await ingestSections({
      userId: user._id.toString(),
      subjectId: subject._id.toString(),
      fileId: fileDoc._id.toString(),
      fileName,
      sections: transcript.sections,
    });

    return NextResponse.json({
      file: {
        id: fileDoc._id,
        fileName,
        parseStatus: "parsed",
        sectionsCount: ingested.sectionsCount,
        chunksCount: ingested.chunksCount,
      },
    });
  } catch (ingestError) {
    const message = ingestError instanceof Error ? ingestError.message : "Failed to process YouTube transcript.";
    await failFileIngestion(fileDoc._id.toString(), message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
