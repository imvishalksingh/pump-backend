import asyncHandler from "express-async-handler";
import Nozzleman from "../models/NozzleMan.js";
import Assignment from "../models/Assignment.js";
import Shift from "../models/Shift.js";

// @desc    Get nozzleman dashboard data
// @route   GET /api/nozzleman/dashboard
// @access  Private (Nozzleman only)
export const getNozzlemanDashboard = asyncHandler(async (req, res) => {
  const nozzlemanId = req.user.nozzlemanProfile;

  if (!nozzlemanId) {
    res.status(403);
    throw new Error("No nozzleman profile found");
  }

  // Get nozzleman details with populated data
  const nozzleman = await Nozzleman.findById(nozzlemanId)
    .populate("assignedPump")
    .populate("assignedNozzles");

  if (!nozzleman) {
    res.status(404);
    throw new Error("Nozzleman not found");
  }

  // Get current assignments
  const currentAssignments = await Assignment.find({
    nozzleman: nozzlemanId,
    status: "Active"
  })
    .populate("nozzle")
    .populate("pump")
    .sort({ assignedDate: -1 });

  // Get recent shifts
  const recentShifts = await Shift.find({
    nozzleman: nozzlemanId
  })
    .populate("pump")
    .populate("nozzle")
    .sort({ startTime: -1 })
    .limit(5);

  // Get today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayShifts = await Shift.find({
    nozzleman: nozzlemanId,
    startTime: { $gte: today },
    status: "Completed"
  });

  const todayFuel = todayShifts.reduce((total, shift) => total + (shift.fuelDispensed || 0), 0);
  const todayCash = todayShifts.reduce((total, shift) => total + (shift.cashCollected || 0), 0);

  res.json({
    profile: nozzleman,
    currentAssignments,
    recentShifts,
    todayStats: {
      fuelDispensed: todayFuel,
      cashCollected: todayCash,
      shiftsCompleted: todayShifts.length
    }
  });
});

// @desc    Get nozzleman shifts
// @route   GET /api/nozzleman/shifts
// @access  Private (Nozzleman only)
export const getNozzlemanShifts = asyncHandler(async (req, res) => {
  const nozzlemanId = req.user.nozzlemanProfile;

  const shifts = await Shift.find({ nozzleman: nozzlemanId })
    .populate("pump")
    .populate("nozzle")
    .sort({ startTime: -1 });

  res.json(shifts);
});