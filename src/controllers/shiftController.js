// controllers/shiftController.js - FIXED VERSION
import Shift from "../models/Shift.js";
import Nozzle from "../models/Nozzle.js";
import Nozzleman from "../models/NozzleMan.js";
import CashHandover from "../models/CashHandover.js"; // Import properly
import asyncHandler from "express-async-handler";

// @desc    Get all shifts
// @route   GET /api/shifts
// @access  Private
export const getShifts = asyncHandler(async (req, res) => {
  const shifts = await Shift.find()
    .populate("nozzleman")
    .populate("pump")
    .populate("nozzle")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });
  res.json(shifts);
});

// @desc    Get shift statistics
// @route   GET /api/shifts/stats
// @access  Private
export const getShiftStats = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // Get active shifts count
    const activeShifts = await Shift.countDocuments({ 
      status: "Active" 
    });

    // Get total dispensed today
    const todayShifts = await Shift.find({
      startTime: { $gte: today, $lt: tomorrow },
      status: "Completed"
    });

    const totalDispensed = todayShifts.reduce((total, shift) => {
      return total + (shift.fuelDispensed || 0);
    }, 0);

    // Get pending approvals (shifts with status "Pending Approval")
    const pendingApprovals = await Shift.countDocuments({
      status: "Pending Approval"
    });

    res.json({
      activeShifts,
      totalDispensed,
      pendingApprovals
    });
  } catch (error) {
    console.error("Error fetching shift stats:", error);
    res.status(500);
    throw new Error("Failed to fetch shift statistics");
  }
});

// @desc    Get single shift
// @route   GET /api/shifts/:id
// @access  Private
export const getShift = asyncHandler(async (req, res) => {
  const shift = await Shift.findById(req.params.id)
    .populate("nozzleman")
    .populate("pump")
    .populate("nozzle")
    .populate("createdBy", "name email");
  
  if (!shift) {
    res.status(404);
    throw new Error("Shift not found");
  }

  res.json(shift);
});

// @desc    Start new shift
// @route   POST /api/shifts/start
// @access  Private
export const startShift = asyncHandler(async (req, res) => {
  const { nozzleman, pump, nozzle, startReading } = req.body;

  if (!nozzleman || !pump || !nozzle || startReading === undefined) {
    res.status(400);
    throw new Error("Please provide nozzleman, pump, nozzle, and start reading");
  }

  // Check if nozzleman exists and is active
  const nozzlemanExists = await Nozzleman.findById(nozzleman);
  if (!nozzlemanExists || nozzlemanExists.status !== "Active") {
    res.status(400);
    throw new Error("Nozzleman not found or inactive");
  }

  // Check if nozzle exists
  const nozzleExists = await Nozzle.findById(nozzle);
  if (!nozzleExists) {
    res.status(404);
    throw new Error("Nozzle not found");
  }

  // Generate shift ID
  const count = await Shift.countDocuments();
  const shiftId = `SH-${String(count + 1).padStart(3, "0")}`;

  const shift = await Shift.create({
    shiftId,
    nozzleman,
    pump,
    nozzle,
    startTime: new Date(),
    startReading,
    status: "Active",
    createdBy: req.user._id,
  });

  // Update nozzleman's total shifts
  await Nozzleman.findByIdAndUpdate(nozzleman, {
    $inc: { totalShifts: 1 },
  });

  const populatedShift = await Shift.findById(shift._id)
    .populate("nozzleman")
    .populate("pump")
    .populate("nozzle")
    .populate("createdBy", "name email");

  res.status(201).json(populatedShift);
});

// @desc    End shift
// @route   PUT /api/shifts/end/:id
// @access  Private

// In shiftController.js - Update endShift function with logging


// controllers/shiftController.js - ONLY CHANGE THIS LINE
export const endShift = asyncHandler(async (req, res) => {
  const { endReading, cashCollected, notes } = req.body;

  const shift = await Shift.findById(req.params.id);
  if (!shift) {
    res.status(404);
    throw new Error("Shift not found");
  }

  console.log("🔍 Ending shift:", shift.shiftId);
  console.log("💰 Cash collected:", cashCollected);

  if (shift.status === "Completed") {
    res.status(400);
    throw new Error("Shift already completed");
  }

  if (endReading === undefined) {
    res.status(400);
    throw new Error("Please provide end reading");
  }

  const fuelDispensed = endReading - shift.startReading;

  // Update shift
  shift.endTime = new Date();
  shift.endReading = endReading;
  shift.fuelDispensed = fuelDispensed;
  shift.cashCollected = cashCollected || 0;
  shift.notes = notes || "";
  
  // ✅ YAHAN CHANGE KARO - "Completed" se "Pending Approval" karo
  shift.status = "Pending Approval"; // 👈 YAHAN CHANGE

  const updatedShift = await shift.save();

  // Create cash handover record - with better logging
  if (cashCollected > 0) {
    console.log("💵 Creating cash handover record...");
    try {
      const cashHandover = await CashHandover.create({
        shift: shift._id,
        nozzleman: shift.nozzleman,
        amount: cashCollected,
        status: "Pending",
        notes: `Cash collected from shift ${shift.shiftId}`
      });
      console.log("✅ Cash handover created:", cashHandover._id);
    } catch (error) {
      console.error("❌ Error creating cash handover:", error);
    }
  } else {
    console.log("ℹ️ No cash collected, skipping cash handover creation");
  }

  // ✅ Response bhejo taki frontend ko pata chale
  res.json({
    message: "Shift ended successfully and sent for approval",
    shift: updatedShift
  });
});



  



// @desc    Update shift
// @route   PUT /api/shifts/:id
// @access  Private
export const updateShift = asyncHandler(async (req, res) => {
  const shift = await Shift.findById(req.params.id);
  
  if (!shift) {
    res.status(404);
    throw new Error("Shift not found");
  }

  // Prevent updating completed shifts
  if (shift.status === "Completed") {
    res.status(400);
    throw new Error("Cannot update completed shift");
  }

  Object.assign(shift, req.body);
  const updatedShift = await shift.save();

  const populatedShift = await Shift.findById(updatedShift._id)
    .populate("nozzleman")
    .populate("pump")
    .populate("nozzle")
    .populate("createdBy", "name email");

  res.json(populatedShift);
});