import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a name"],
    trim: true,
    maxlength: [50, "Name cannot be more than 50 characters"]
  },
  email: {
    type: String,
    required: [true, "Please add an email"],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email"
    ]
  },
  password: {
    type: String,
    required: [true, "Please add a password"],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ["admin", "manager", "auditor", "nozzleman", "cashier", "stockkeeper"],
    default: "auditor"
  },
  status: {
    type: String,
    enum: ["active", "suspended"],
    default: "active"
  },
  // ADD THIS: Reference to nozzleman profile
  nozzlemanProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Nozzleman"
  }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!enteredPassword) {
    throw new Error("No password provided for comparison");
  }
  
  if (!this.password) {
    throw new Error("User password not available");
  }
  
  return await bcrypt.compare(enteredPassword, this.password);
};

// Change password method
userSchema.methods.changePassword = async function (currentPassword, newPassword) {
  // Verify current password
  const isMatch = await this.matchPassword(currentPassword);
  if (!isMatch) {
    throw new Error("Current password is incorrect");
  }

  // Update password
  this.password = newPassword;
  await this.save();
};

const User = mongoose.model("User", userSchema);
export default User;