import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const subjectSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 64,
    },
    slot: {
      type: Number,
      required: true,
      enum: [1, 2, 3],
    },
  },
  {
    timestamps: true,
  },
);

subjectSchema.index({ userId: 1, slot: 1 }, { unique: true });
subjectSchema.index({ userId: 1, name: 1 }, { unique: true });

export type SubjectDocument = InferSchemaType<typeof subjectSchema> & {
  _id: string;
};

export const SubjectModel: Model<SubjectDocument> =
  (models.Subject as Model<SubjectDocument> | undefined) || model<SubjectDocument>("Subject", subjectSchema);
