// controllers/assignmentController.js - COMPLETE VERSION
import Assignment from "../models/Assignment.js";
import Nozzleman from "../models/NozzleMan.js";
import Nozzle from "../models/Nozzle.js";
import Pump from "../models/Pump.js";
import asyncHandler from "express-async-handler";

// @desc    Get all assignments
// @route   GET /api/assignments
// @access  Private
export const getAssignments = asyncHandler(async (req, res) => {
  try {
    const { nozzleman, date, status } = req.query;
    
    let filter = {};
    
    if (nozzleman) {
      filter.nozzleman = nozzleman;
    }
    
    if (date) {
      filter.assignedDate = date;
    }
    
    if (status) {
      filter.status = status;
    }

    const assignments = await Assignment.find(filter)
      .populate("nozzleman", "name employeeId mobile")
      .populate("nozzle", "number fuelType currentReading")
      .populate("pump", "name location fuelType")
      .sort({ assignedDate: -1, shift: 1 });

    res.json(assignments);
  } catch (error) {
    console.error("Error in getAssignments:", error);
    res.status(500);
    throw new Error("Failed to fetch assignments");
  }
});

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private
export const createAssignment = asyncHandler(async (req, res) => {
  try {
    const { nozzleman, nozzle, pump, shift, assignedDate, startTime, endTime } = req.body;

    console.log("📨 Received assignment data:", req.body);
    console.log("👤 User creating assignment:", req.user._id);

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

    // Check if nozzle exists and is active
    const nozzleExists = await Nozzle.findById(nozzle);
    if (!nozzleExists || nozzleExists.status !== "Active") {
      res.status(400);
      throw new Error("Nozzle not found or inactive");
    }

    // Check if pump exists
    const pumpExists = await Pump.findById(pump);
    if (!pumpExists) {
      res.status(404);
      throw new Error("Pump not found");
    }

    // Check for duplicate assignment
    const existingAssignment = await Assignment.findOne({
      nozzleman,
      assignedDate: new Date(assignedDate),
      shift,
      status: "Active"
    });

    if (existingAssignment) {
      res.status(400);
      throw new Error("Nozzleman already has an active assignment for this shift on the selected date");
    }

    // Check if nozzle is already assigned
    const nozzleAssignment = await Assignment.findOne({
      nozzle,
      assignedDate: new Date(assignedDate),
      shift,
      status: "Active"
    });

    if (nozzleAssignment) {
      res.status(400);
      throw new Error("Nozzle is already assigned to another nozzleman for this shift on the selected date");
    }

    // Create assignment with createdBy field
    const assignment = await Assignment.create({
      nozzleman,
      nozzle,
      pump,
      shift,
      assignedDate: new Date(assignedDate),
      startTime: startTime || "08:00",
      endTime: endTime || "16:00",
      status: "Active",
      createdBy: req.user._id, // ✅ ADD THIS LINE
    });

    console.log("✅ Assignment created successfully:", assignment._id);

    // Update nozzleman's assigned nozzles and pump
    await Nozzleman.findByIdAndUpdate(nozzleman, {
      assignedPump: pump,
      $addToSet: { assignedNozzles: nozzle },
    });

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate("nozzleman", "name employeeId mobile")
      .populate("nozzle", "number fuelType currentReading")
      .populate("pump", "name location fuelType")
      .populate("createdBy", "name email");

    res.status(201).json(populatedAssignment);
  } catch (error) {
    console.error("❌ Error in createAssignment:", error);
    res.status(500);
    throw new Error("Failed to create assignment");
  }
});

// @desc    Remove assignment
// @route   DELETE /api/assignments/:id
// @access  Private
export const removeAssignment = asyncHandler(async (req, res) => {
  try {
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
    
    res.json({ 
      success: true,
      message: "Assignment removed successfully" 
    });
  } catch (error) {
    console.error("Error in removeAssignment:", error);
    res.status(500);
    throw new Error("Failed to remove assignment");
  }
});

// @desc    Update assignment status
// @route   PATCH /api/assignments/:id/status
// @access  Private
export const updateAssignmentStatus = asyncHandler(async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Active", "Completed", "Cancelled"].includes(status)) {
      res.status(400);
      throw new Error("Invalid status value");
    }

    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
    .populate("nozzleman", "name employeeId mobile")
    .populate("nozzle", "number fuelType")
    .populate("pump", "name location");

    if (!assignment) {
      res.status(404);
      throw new Error("Assignment not found");
    }

    res.json(assignment);
  } catch (error) {
    console.error("Error in updateAssignmentStatus:", error);
    res.status(500);
    throw new Error("Failed to update assignment status");
  }
});

// @desc    Get today's assignments for nozzleman
// @route   GET /api/assignments/today/:nozzlemanId
// @access  Private
export const getTodayAssignments = asyncHandler(async (req, res) => {
  try {
    const { nozzlemanId } = req.params;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const assignments = await Assignment.find({
      nozzleman: nozzlemanId,
      assignedDate: today,
      status: "Active"
    })
    .populate("nozzle", "number fuelType currentReading")
    .populate("pump", "name location")
    .sort({ shift: 1 });

    res.json(assignments);
  } catch (error) {
    console.error("Error in getTodayAssignments:", error);
    res.status(500);
    throw new Error("Failed to fetch today's assignments");
  }
});

export const createBulkAssignments = asyncHandler(async (req, res) => {
  try {
    const { assignments } = req.body;

    console.log("📦 Received bulk assignments request:", assignments?.length, "assignments");

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      res.status(400);
      throw new Error("Please provide an array of assignments");
    }

    // Validate maximum assignments per request
    if (assignments.length > 50) {
      res.status(400);
      throw new Error("Maximum 50 assignments allowed per bulk request");
    }

    const createdAssignments = [];
    const errors = [];
    const skipped = [];

    for (const [index, assignmentData] of assignments.entries()) {
      try {
        const { nozzleman, nozzle, pump, shift, assignedDate, startTime, endTime } = assignmentData;

        // Validate required fields
        if (!nozzleman || !nozzle || !pump || !shift || !assignedDate) {
          errors.push(`Assignment ${index + 1}: Missing required fields`);
          continue;
        }

        // Check if nozzleman exists and is active
        const nozzlemanExists = await Nozzleman.findById(nozzleman);
        if (!nozzlemanExists || nozzlemanExists.status !== "Active") {
          errors.push(`Assignment ${index + 1}: Nozzleman not found or inactive`);
          continue;
        }

        // Check if nozzle exists and is active
        const nozzleExists = await Nozzle.findById(nozzle);
        if (!nozzleExists || nozzleExists.status !== "Active") {
          errors.push(`Assignment ${index + 1}: Nozzle not found or inactive`);
          continue;
        }

        // Check if pump exists
        const pumpExists = await Pump.findById(pump);
        if (!pumpExists) {
          errors.push(`Assignment ${index + 1}: Pump not found`);
          continue;
        }

        // Check for duplicate assignment (same nozzleman, same date, same shift)
        const existingAssignmentForNozzleman = await Assignment.findOne({
          nozzleman,
          assignedDate: new Date(assignedDate),
          shift,
          status: "Active"
        });

        if (existingAssignmentForNozzleman) {
          skipped.push(`Assignment ${index + 1}: Nozzleman already has assignment for ${shift} shift on ${assignedDate}`);
          continue;
        }

        // Check if nozzle is already assigned to someone else
        const existingAssignmentForNozzle = await Assignment.findOne({
          nozzle,
          assignedDate: new Date(assignedDate),
          shift,
          status: "Active"
        });

        if (existingAssignmentForNozzle) {
          skipped.push(`Assignment ${index + 1}: Nozzle already assigned to another nozzleman for ${shift} shift on ${assignedDate}`);
          continue;
        }

        // Create assignment
        const assignment = await Assignment.create({
          nozzleman,
          nozzle,
          pump,
          shift,
          assignedDate: new Date(assignedDate),
          startTime: startTime || "08:00",
          endTime: endTime || "16:00",
          status: "Active",
          createdBy: req.user._id,
        });

        // Update nozzleman's assigned nozzles and pump
        await Nozzleman.findByIdAndUpdate(nozzleman, {
          assignedPump: pump,
          $addToSet: { assignedNozzles: nozzle },
        });

        const populatedAssignment = await Assignment.findById(assignment._id)
          .populate("nozzleman", "name employeeId")
          .populate("nozzle", "number fuelType")
          .populate("pump", "name location");

        createdAssignments.push(populatedAssignment);

        console.log(`✅ Created assignment ${index + 1}: ${nozzlemanExists.name} -> ${nozzleExists.number}`);

      } catch (error) {
        console.error(`❌ Error creating assignment ${index + 1}:`, error);
        errors.push(`Assignment ${index + 1}: ${error.message}`);
      }
    }

    const response = {
      success: true,
      created: createdAssignments.length,
      skipped: skipped.length,
      errors: errors.length,
      assignments: createdAssignments,
      details: {
        createdCount: createdAssignments.length,
        skippedCount: skipped.length,
        errorCount: errors.length
      }
    };

    // Add warnings if there are skipped or errors
    if (skipped.length > 0) {
      response.skippedDetails = skipped;
    }

    if (errors.length > 0) {
      response.errorDetails = errors;
    }

    console.log(`📊 Bulk assignment result: ${createdAssignments.length} created, ${skipped.length} skipped, ${errors.length} errors`);

    res.status(201).json(response);

  } catch (error) {
    console.error("❌ Error in createBulkAssignments:", error);
    res.status(500);
    throw new Error("Failed to create bulk assignments");
  }
});