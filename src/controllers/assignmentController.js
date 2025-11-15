import Assignment from "../models/Assignment.js";
import Nozzleman from "../models/NozzleMan.js";
import asyncHandler from "express-async-handler";

// @desc    Get all assignments
// @route   GET /api/assignments
// @access  Private
export const getAssignments = asyncHandler(async (req, res) => {
  const assignments = await Assignment.find()
    .populate("nozzleman")
    .populate("nozzle")
    .populate("pump")
    .sort({ assignedDate: -1 });
  res.json(assignments);
});

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private
export const createAssignment = asyncHandler(async (req, res) => {
  const { nozzleman, nozzle, pump, shift, assignedDate, startTime, endTime } = req.body;

  if (!nozzleman || !nozzle || !pump || !shift || !assignedDate) {
    res.status(400);
    throw new Error("Please provide nozzleman, nozzle, pump, shift, and assigned date");
  }

  // Check if nozzleman exists and is active
  const nozzlemanExists = await Nozzleman.findById(nozzleman);
  if (!nozzlemanExists || nozzlemanExists.status !== "Active") {
    res.status(400);
    throw new Error("Nozzleman not found or inactive");
  }

  const assignment = await Assignment.create({
    nozzleman,
    nozzle,
    pump,
    shift,
    assignedDate: new Date(assignedDate),
    startTime,
    endTime,
    status: "Active",
  });

  // Update nozzleman's assigned nozzles and pump
  await Nozzleman.findByIdAndUpdate(nozzleman, {
    assignedPump: pump,
    $addToSet: { assignedNozzles: nozzle },
  });

  const populatedAssignment = await Assignment.findById(assignment._id)
    .populate("nozzleman")
    .populate("nozzle")
    .populate("pump");

  res.status(201).json(populatedAssignment);
});

// @desc    Remove assignment
// @route   DELETE /api/assignments/:id
// @access  Private
export const removeAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  
  if (!assignment) {
    res.status(404);
    throw new Error("Assignment not found");
  }

  // Remove from nozzleman's assigned nozzles
  await Nozzleman.findByIdAndUpdate(assignment.nozzleman, {
    $pull: { assignedNozzles: assignment.nozzle },
  });

  await Assignment.findByIdAndDelete(req.params.id);
  res.json({ message: "Assignment removed successfully" });
});

// @desc    Update assignment status
// @route   PATCH /api/assignments/:id/status
// @access  Private
export const updateAssignmentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const assignment = await Assignment.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).populate("nozzleman").populate("nozzle").populate("pump");

  if (!assignment) {
    res.status(404);
    throw new Error("Assignment not found");
  }

  res.json(assignment);
});