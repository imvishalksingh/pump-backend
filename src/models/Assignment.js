// models/Assignment.js - COMPLETE VERSION
import mongoose from "mongoose";


const assignmentSchema = mongoose.Schema(
  {
    nozzleman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzleman",
      required: true,
    },
    nozzle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzle",
      required: true,
    },
    pump: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pump",
      required: true,
    },
    shift: {
      type: String,
      enum: ["Morning", "Evening", "Night"],
      required: true,
    },
    assignedDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      default: "08:00",
    },
    endTime: {
      type: String,
      default: "16:00",
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "Cancelled"],
      default: "Active",
    },
    // ✅ Make createdBy optional or provide default
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true, // Remove this line to make it optional
      default: null // Or set a default user ID
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate active assignments for same nozzleman, date, and shift
assignmentSchema.index(
  { 
    nozzleman: 1, 
    assignedDate: 1, 
    shift: 1, 
    status: 1 
  }, 
  { 
    unique: true, 
    partialFilterExpression: { status: "Active" } 
  }
);

// Index for nozzle assignments to prevent double-booking
assignmentSchema.index(
  { 
    nozzle: 1, 
    assignedDate: 1, 
    shift: 1, 
    status: 1 
  }, 
  { 
    unique: true, 
    partialFilterExpression: { status: "Active" } 
  }
);

// Index for efficient querying
assignmentSchema.index({ assignedDate: 1, status: 1 });
assignmentSchema.index({ nozzleman: 1, assignedDate: 1 });
assignmentSchema.index({ pump: 1, assignedDate: 1 });

// Virtual for checking if assignment is for today
assignmentSchema.virtual('isToday').get(function() {
  const today = new Date().toDateString();
  return this.assignedDate.toDateString() === today;
});

// Virtual for checking if assignment is in the past
assignmentSchema.virtual('isPast').get(function() {
  return this.assignedDate < new Date();
});

// Virtual for checking if assignment is in the future
assignmentSchema.virtual('isFuture').get(function() {
  return this.assignedDate > new Date();
});

// Method to check if assignment can be started
assignmentSchema.methods.canStart = function() {
  const now = new Date();
  const assignmentDate = new Date(this.assignedDate);
  const isToday = assignmentDate.toDateString() === now.toDateString();
  
  if (!isToday) return false;
  if (this.status !== "Active") return false;
  
  // Check if current time is within shift timings (simplified)
  return true;
};

// Pre-save middleware to validate assignment
assignmentSchema.pre('save', function(next) {
  // Validate that assignedDate is not in the past for new assignments
  if (this.isNew && this.assignedDate < new Date().setHours(0, 0, 0, 0)) {
    next(new Error("Cannot create assignments for past dates"));
    return;
  }

  // Validate shift timings
  if (this.startTime && this.endTime) {
    const start = parseInt(this.startTime.replace(':', ''));
    const end = parseInt(this.endTime.replace(':', ''));
    if (start >= end) {
      next(new Error("Start time must be before end time"));
      return;
    }
  }

  next();
});

const Assignment = mongoose.model("Assignment", assignmentSchema);

export default Assignment;