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
    },
    endTime: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "Cancelled"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

const Assignment = mongoose.model("Assignment", assignmentSchema);
export default Assignment;