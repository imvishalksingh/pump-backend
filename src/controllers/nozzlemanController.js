import Nozzleman from "../models/NozzleMan.js";
import asyncHandler from "express-async-handler";

// @desc    Get all nozzlemen
// @route   GET /api/nozzlemen
// @access  Private
export const getNozzlemen = async (req, res) => {
  try {
    const nozzlemen = await Nozzleman.find()
      .populate('assignedPump', 'name location fuelType')
      .populate('assignedNozzles', 'number fuelType currentReading pump');
    
    res.json({
      success: true,
      data: nozzlemen
    });
  } catch (error) {
    console.error("Error fetching nozzlemen:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single nozzleman
// @route   GET /api/nozzlemen/:id
// @access  Private
export const getNozzleman = asyncHandler(async (req, res) => {
  const nozzleman = await Nozzleman.findById(req.params.id)
    .populate("assignedPump")
    .populate("assignedNozzles");
  
  if (!nozzleman) {
    res.status(404);
    throw new Error("Nozzleman not found");
  }

  res.json(nozzleman);
});

// @desc    Create new nozzleman
// @route   POST /api/nozzlemen
// @access  Private
export const createNozzleman = asyncHandler(async (req, res) => {
  const { name, mobile, shift, status } = req.body;

  if (!name || !mobile || !shift) {
    res.status(400);
    throw new Error("Please provide name, mobile, and shift");
  }

  // Generate employee ID
  const count = await Nozzleman.countDocuments();
  const employeeId = `NM-${String(count + 1).padStart(3, "0")}`;

  const nozzleman = await Nozzleman.create({
    employeeId,
    name,
    mobile,
    shift,
    status: status || "Active",
    assignedNozzles: [],
    totalShifts: 0,
    totalFuelDispensed: 0,
    averageCashHandled: 0,
    rating: 0,
    joinDate: new Date(),
  });

  res.status(201).json(nozzleman);
});

// @desc    Update nozzleman
// @route   PUT /api/nozzlemen/:id
// @access  Private
export const updateNozzleman = asyncHandler(async (req, res) => {
  const nozzleman = await Nozzleman.findById(req.params.id);
  
  if (!nozzleman) {
    res.status(404);
    throw new Error("Nozzleman not found");
  }

  const { name, mobile, shift, status, assignedPump, assignedNozzles, rating } = req.body;
  
  nozzleman.name = name || nozzleman.name;
  nozzleman.mobile = mobile || nozzleman.mobile;
  nozzleman.shift = shift || nozzleman.shift;
  nozzleman.status = status || nozzleman.status;
  nozzleman.assignedPump = assignedPump !== undefined ? assignedPump : nozzleman.assignedPump;
  nozzleman.assignedNozzles = assignedNozzles || nozzleman.assignedNozzles;
  nozzleman.rating = rating !== undefined ? rating : nozzleman.rating;

  const updatedNozzleman = await nozzleman.save();
  const populatedNozzleman = await Nozzleman.findById(updatedNozzleman._id)
    .populate("assignedPump")
    .populate("assignedNozzles");
  
  res.json(populatedNozzleman);
});

// @desc    Delete nozzleman
// @route   DELETE /api/nozzlemen/:id
// @access  Private
export const deleteNozzleman = asyncHandler(async (req, res) => {
  const nozzleman = await Nozzleman.findById(req.params.id);
  
  if (!nozzleman) {
    res.status(404);
    throw new Error("Nozzleman not found");
  }

  await Nozzleman.findByIdAndDelete(req.params.id);
  res.json({ message: "Nozzleman removed successfully" });
});