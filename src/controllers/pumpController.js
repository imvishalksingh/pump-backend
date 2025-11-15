// controllers/pumpController.js
import Pump from "../models/Pump.js";
import asyncHandler from "express-async-handler";

// @desc    Create new pump
// @route   POST /api/pumps
// @access  Private
export const createPump = asyncHandler(async (req, res) => {
  const { name, location, fuelType, status, currentReading } = req.body;

  if (!name || !location || !fuelType) {
    res.status(400);
    throw new Error("Please provide name, location, and fuel type");
  }

  const pump = await Pump.create({
    name,
    location,
    fuelType,
    status: status || "Active",
    currentReading: currentReading || 0,
    totalSales: 0,
    lastCalibration: new Date()
  });

  res.status(201).json(pump);
});

// @desc    Get all pumps
// @route   GET /api/pumps
// @access  Private
export const getPumps = asyncHandler(async (req, res) => {
  const pumps = await Pump.find().populate("nozzles").sort({ createdAt: -1 });
  res.json(pumps);
});

// @desc    Get single pump
// @route   GET /api/pumps/:id
// @access  Private
export const getPump = asyncHandler(async (req, res) => {
  const pump = await Pump.findById(req.params.id).populate("nozzles");
  
  if (!pump) {
    res.status(404);
    throw new Error("Pump not found");
  }

  res.json(pump);
});

// @desc    Update pump
// @route   PUT /api/pumps/:id
// @access  Private
export const updatePump = asyncHandler(async (req, res) => {
  const pump = await Pump.findById(req.params.id);
  
  if (!pump) {
    res.status(404);
    throw new Error("Pump not found");
  }

  const { name, location, fuelType, status, currentReading, lastCalibration } = req.body;
  
  pump.name = name || pump.name;
  pump.location = location || pump.location;
  pump.fuelType = fuelType || pump.fuelType;
  pump.status = status || pump.status;
  pump.currentReading = currentReading !== undefined ? currentReading : pump.currentReading;
  pump.lastCalibration = lastCalibration || pump.lastCalibration;

  const updatedPump = await pump.save();
  res.json(updatedPump);
});

// @desc    Delete pump
// @route   DELETE /api/pumps/:id
// @access  Private
export const deletePump = asyncHandler(async (req, res) => {
  const pump = await Pump.findById(req.params.id);
  
  if (!pump) {
    res.status(404);
    throw new Error("Pump not found");
  }

  await Pump.findByIdAndDelete(req.params.id);
  res.json({ message: "Pump removed successfully" });
});