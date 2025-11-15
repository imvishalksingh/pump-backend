import Nozzle from "../models/Nozzle.js";
import Pump from "../models/Pump.js";
import asyncHandler from "express-async-handler";

// @desc    Get all nozzles
// @route   GET /api/nozzles
// @access  Private
export const getNozzles = asyncHandler(async (req, res) => {
  const nozzles = await Nozzle.find().populate("pump").sort({ createdAt: -1 });
  res.json(nozzles);
});

// @desc    Get single nozzle
// @route   GET /api/nozzles/:id
// @access  Private
export const getNozzle = asyncHandler(async (req, res) => {
  const nozzle = await Nozzle.findById(req.params.id).populate("pump");
  
  if (!nozzle) {
    res.status(404);
    throw new Error("Nozzle not found");
  }

  res.json(nozzle);
});

// @desc    Create new nozzle
// @route   POST /api/nozzles
// @access  Private
export const createNozzle = asyncHandler(async (req, res) => {
  const { number, pump, fuelType, status, currentReading, rate } = req.body;

  if (!number || !pump || !fuelType) {
    res.status(400);
    throw new Error("Please provide number, pump, and fuel type");
  }

  // Check if pump exists
  const pumpExists = await Pump.findById(pump);
  if (!pumpExists) {
    res.status(404);
    throw new Error("Pump not found");
  }

  const nozzle = await Nozzle.create({
    number,
    pump,
    fuelType,
    status: status || "Active",
    currentReading: currentReading || 0,
    rate: rate || 0,
    lastCalibration: new Date(),
  });

  // Add nozzle to pump's nozzles array
  await Pump.findByIdAndUpdate(pump, {
    $push: { nozzles: nozzle._id },
  });

  const populatedNozzle = await Nozzle.findById(nozzle._id).populate("pump");
  res.status(201).json(populatedNozzle);
});

// @desc    Update nozzle
// @route   PUT /api/nozzles/:id
// @access  Private
export const updateNozzle = asyncHandler(async (req, res) => {
  const nozzle = await Nozzle.findById(req.params.id);
  
  if (!nozzle) {
    res.status(404);
    throw new Error("Nozzle not found");
  }

  const { number, pump, fuelType, status, currentReading, rate } = req.body;
  
  nozzle.number = number || nozzle.number;
  nozzle.fuelType = fuelType || nozzle.fuelType;
  nozzle.status = status || nozzle.status;
  nozzle.currentReading = currentReading !== undefined ? currentReading : nozzle.currentReading;
  nozzle.rate = rate !== undefined ? rate : nozzle.rate;

  // Handle pump change
  if (pump && pump !== nozzle.pump.toString()) {
    // Remove from old pump
    await Pump.findByIdAndUpdate(nozzle.pump, {
      $pull: { nozzles: nozzle._id },
    });
    
    // Add to new pump
    nozzle.pump = pump;
    await Pump.findByIdAndUpdate(pump, {
      $push: { nozzles: nozzle._id },
    });
  }

  const updatedNozzle = await nozzle.save();
  const populatedNozzle = await Nozzle.findById(updatedNozzle._id).populate("pump");
  res.json(populatedNozzle);
});

// @desc    Delete nozzle
// @route   DELETE /api/nozzles/:id
// @access  Private
export const deleteNozzle = asyncHandler(async (req, res) => {
  const nozzle = await Nozzle.findById(req.params.id);
  
  if (!nozzle) {
    res.status(404);
    throw new Error("Nozzle not found");
  }

  // Remove nozzle from pump's nozzles array
  await Pump.findByIdAndUpdate(nozzle.pump, {
    $pull: { nozzles: nozzle._id },
  });

  await Nozzle.findByIdAndDelete(req.params.id);
  res.json({ message: "Nozzle removed successfully" });
});

// @desc    Update nozzle reading
// @route   PATCH /api/nozzles/:id/reading
// @access  Private
export const updateNozzleReading = asyncHandler(async (req, res) => {
  const { currentReading } = req.body;

  if (currentReading === undefined) {
    res.status(400);
    throw new Error("Please provide current reading");
  }

  const nozzle = await Nozzle.findById(req.params.id);
  if (!nozzle) {
    res.status(404);
    throw new Error("Nozzle not found");
  }

  const fuelDispensed = currentReading - nozzle.currentReading;

  nozzle.currentReading = currentReading;
  nozzle.totalDispensed += fuelDispensed;

  const updatedNozzle = await nozzle.save();
  res.json(updatedNozzle);
});