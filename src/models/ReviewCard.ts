import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const reviewCardSchema = new Schema(
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
    chunkId: {
      type: String,
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
    prompt: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    evidenceSnippet: {
      type: String,
      default: "",
    },
    dueAt: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    lastReviewedAt: {
      type: Date,
      default: null,
    },
    repetitions: {
      type: Number,
      default: 0,
    },
    intervalDays: {
      type: Number,
      default: 0,
    },
    easeFactor: {
      type: Number,
      default: 2.5,
    },
    lapses: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    lastRating: {
      type: String,
      enum: ["again", "hard", "good", "easy", null],
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

reviewCardSchema.index({ userId: 1, subjectId: 1, chunkId: 1 }, { unique: true });
reviewCardSchema.index({ userId: 1, subjectId: 1, dueAt: 1 });
reviewCardSchema.index({ userId: 1, subjectId: 1, lastReviewedAt: -1 });

export type ReviewCardDocument = InferSchemaType<typeof reviewCardSchema> & {
  _id: string;
};

export const ReviewCardModel: Model<ReviewCardDocument> =
  (models.ReviewCard as Model<ReviewCardDocument> | undefined) || model<ReviewCardDocument>("ReviewCard", reviewCardSchema);

