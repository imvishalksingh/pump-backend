// models/Invitation.js
import mongoose from "mongoose";
import crypto from "crypto";

const invitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Please add an email"],
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email"
    ]
  },
  role: {
    type: String,
    enum: ["admin", "manager", "auditor"],
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString("hex") // FIX: Add default
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  used: {
    type: Boolean,
    default: false
  },
  usedAt: Date
}, {
  timestamps: true
});

// Remove the pre-save hook since we're using default
// invitationSchema.pre("save", function (next) {
//   if (!this.token) {
//     this.token = crypto.randomBytes(32).toString("hex");
//   }
//   next();
// });

// Index for faster queries
invitationSchema.index({ email: 1, token: 1 });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;