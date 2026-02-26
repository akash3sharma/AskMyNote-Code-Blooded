import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const chunkSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    fileId: {
      type: Schema.Types.ObjectId,
      ref: "NoteFile",
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    pageOrSection: {
      type: String,
      required: true,
    },
    chunkId: {
      type: String,
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

chunkSchema.index({ userId: 1, subjectId: 1, createdAt: -1 });
chunkSchema.index({ userId: 1, subjectId: 1, chunkId: 1 }, { unique: true });

export type ChunkDocument = InferSchemaType<typeof chunkSchema> & {
  _id: string;
};

export const ChunkModel: Model<ChunkDocument> =
  (models.Chunk as Model<ChunkDocument> | undefined) || model<ChunkDocument>("Chunk", chunkSchema);
