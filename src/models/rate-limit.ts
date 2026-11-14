import mongoose, { Document, Model, Schema } from "mongoose";

export interface IRateLimit extends Document {
  key: string;
  count: number;
  resetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
      default: 1,
    },
    resetAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index: automatically deletes document once resetAt is reached
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate model compilation in Next.js hot-reload
export const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

