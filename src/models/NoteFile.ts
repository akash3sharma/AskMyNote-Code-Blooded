import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const noteFileSchema = new Schema(
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
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    parseStatus: {
      type: String,
      enum: ["processing", "parsed", "error"],
      default: "processing",
      index: true,
    },
    sectionsCount: {
      type: Number,
      default: 0,
    },
    chunksCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

noteFileSchema.index({ userId: 1, subjectId: 1, createdAt: -1 });

export type NoteFileDocument = InferSchemaType<typeof noteFileSchema> & {
  _id: string;
};

export const NoteFileModel: Model<NoteFileDocument> =
  (models.NoteFile as Model<NoteFileDocument> | undefined) || model<NoteFileDocument>("NoteFile", noteFileSchema);
