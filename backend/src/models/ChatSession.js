import mongoose from "mongoose";

const ChatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
      trim: true,
    },
    modelUsed: {
      type: String,
      default: "gpt-3.5-turbo",
      enum: ["gpt-3.5-turbo", "gpt-4", "gemini-pro", "claude-3-haiku"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2,
      },
      maxTokens: {
        type: Number,
        default: 1000,
      },
      contextWindow: {
        type: Number,
        default: 4096,
      },
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ✅ Virtual populate */
ChatSessionSchema.virtual("messages", {
  ref: "ChatHistory",
  localField: "_id",
  foreignField: "session",
});

/* ✅ Instance method */
ChatSessionSchema.methods.generateTitle = async function () {
  const ChatHistory = mongoose.model("ChatHistory");

  const firstMessage = await ChatHistory.findOne({
    session: this._id,
    role: "user",
  }).sort({ createdAt: 1 });

  if (firstMessage) {
    const content = firstMessage.content.substring(0, 50);
    this.title = content + (content.length === 50 ? "..." : "");
  }
};

const ChatSession = mongoose.model("ChatSession", ChatSessionSchema);
export default ChatSession;
