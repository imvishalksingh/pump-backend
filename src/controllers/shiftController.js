// controllers/shiftController.js - COMPLETE VERSION
import Shift from "../models/Shift.js";
import Nozzle from "../models/Nozzle.js";
import Nozzleman from "../models/NozzleMan.js";
import Assignment from "../models/Assignment.js";
import CashHandover from "../models/CashHandover.js";
import asyncHandler from "express-async-handler";

// @desc    Get all shifts with filters
// @route   GET /api/shifts
// @access  Private
export const getShifts = asyncHandler(async (req, res) => {
  try {
    const {
      status,
      nozzlemanId,
      pumpId,
      nozzleId,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    // Build filter object
    let filter = {};

    if (status) filter.status = status;
    if (nozzlemanId) filter.nozzleman = nozzlemanId;
    if (pumpId) filter.pump = pumpId;
    if (nozzleId) filter.nozzle = nozzleId;

    // Date range filter
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.startTime.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.startTime.$lte = end;
      }
    }

    const skip = (page - 1) * limit;

    // Get shifts with population
    const shifts = await Shift.find(filter)
      .populate("nozzleman", "name employeeId mobile")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("createdBy", "name email")
      .populate("auditedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Shift.countDocuments(filter);

    res.json({
      shifts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalShifts: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Error in getShifts:", error);
    res.status(500);
    throw new Error("Failed to fetch shifts");
  }
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
      status: { $in: ["Completed", "Approved", "Pending Approval"] }
    });

    const totalDispensed = todayShifts.reduce((total, shift) => {
      return total + (shift.fuelDispensed || 0);
    }, 0);

    // Get total cash collected today
    const totalCash = todayShifts.reduce((total, shift) => {
      return total + (shift.cashCollected || 0);
    }, 0);

    // Get pending approvals
    const pendingApprovals = await Shift.countDocuments({
      status: "Pending Approval"
    });

    // Get shifts by status
    const shiftsByStatus = await Shift.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      activeShifts,
      totalDispensed,
      totalCash,
      pendingApprovals,
      shiftsByStatus,
      todayShifts: todayShifts.length
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
  try {
    const shift = await Shift.findById(req.params.id)
      .populate("nozzleman", "name employeeId mobile shift status")
      .populate("pump", "name location fuelType")
      .populate("nozzle", "number fuelType currentReading rate")
      .populate("createdBy", "name email")
      .populate("auditedBy", "name email");
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    res.json(shift);
  } catch (error) {
    console.error("Error in getShift:", error);
    res.status(500);
    throw new Error("Failed to fetch shift");
  }
});

// @desc    Get assigned nozzles for logged-in nozzleman
// @route   GET /api/shifts/assigned-nozzles
// @access  Private (Nozzleman only)
export const getAssignedNozzles = asyncHandler(async (req, res) => {
  try {
    const nozzlemanId = req.user.nozzlemanProfile;

    if (!nozzlemanId) {
      res.status(403);
      throw new Error("No nozzleman profile found");
    }

    const currentAssignments = await Assignment.find({
      nozzleman: nozzlemanId,
      status: "Active"
    })
      .populate("nozzle", "number fuelType currentReading status")
      .populate("pump", "name location fuelType")
      .sort({ assignedDate: -1 });

    // Check if nozzleman has any active shifts
    const activeShift = await Shift.findOne({
      nozzleman: nozzlemanId,
      status: "Active"
    });

    res.json({
      assignments: currentAssignments,
      hasActiveShift: !!activeShift,
      activeShiftId: activeShift?._id
    });
  } catch (error) {
    console.error("Error in getAssignedNozzles:", error);
    res.status(500);
    throw new Error("Failed to fetch assigned nozzles");
  }
});

// @desc    Start new shift
// @route   POST /api/shifts/start
// @access  Private
export const startShift = asyncHandler(async (req, res) => {
  try {
    console.log("🔍 Start Shift Request Body:", req.body);
    console.log("👤 User making request:", req.user._id);

    const { 
      nozzleman, 
      pump, 
      nozzle, 
      startReading, 
      startReadingImage,
      assignmentId // Optional: for assignment-based shifts
    } = req.body;

    // Validate required fields
    if (!nozzleman) {
      return res.status(400).json({
        success: false,
        error: "Nozzleman ID is required"
      });
    }

    if (!pump) {
      return res.status(400).json({
        success: false,
        error: "Pump ID is required"
      });
    }

    if (!nozzle) {
      return res.status(400).json({
        success: false,
        error: "Nozzle ID is required"
      });
    }

    if (startReading === undefined || startReading === null) {
      return res.status(400).json({
        success: false,
        error: "Start reading is required"
      });
    }

    if (!startReadingImage) {
      return res.status(400).json({
        success: false,
        error: "Start reading proof image is required"
      });
    }

    // Check if nozzleman exists and is active
    const nozzlemanExists = await Nozzleman.findById(nozzleman);
    if (!nozzlemanExists) {
      return res.status(400).json({
        success: false,
        error: "Nozzleman not found"
      });
    }

    if (nozzlemanExists.status !== "Active") {
      return res.status(400).json({
        success: false,
        error: "Nozzleman is not active"
      });
    }

    // Check if nozzle exists and is active
    const nozzleExists = await Nozzle.findById(nozzle);
    if (!nozzleExists) {
      return res.status(404).json({
        success: false,
        error: "Nozzle not found"
      });
    }

    if (nozzleExists.status !== "Active") {
      return res.status(400).json({
        success: false,
        error: "Nozzle is not active"
      });
    }

    // Check if nozzleman already has active shift
    const existingActiveShift = await Shift.findOne({
      nozzleman,
      status: "Active"
    });

    if (existingActiveShift) {
      return res.status(400).json({
        success: false,
        error: "Nozzleman already has an active shift",
        activeShiftId: existingActiveShift._id
      });
    }

    // If assignmentId is provided, verify it belongs to the nozzleman
    if (assignmentId) {
      const assignment = await Assignment.findOne({
        _id: assignmentId,
        nozzleman: nozzleman,
        status: "Active"
      });
      
      if (!assignment) {
        return res.status(400).json({
          success: false,
          error: "Invalid assignment or assignment not active"
        });
      }
    }

    // Generate shift ID
    const count = await Shift.countDocuments();
    const shiftId = `SH-${String(count + 1).padStart(4, "0")}`;

    console.log("📝 Creating shift with data:", {
      shiftId,
      nozzleman,
      pump,
      nozzle,
      startReading,
      assignmentId
    });

    // Create shift data
    const shiftData = {
      shiftId,
      nozzleman,
      pump,
      nozzle,
      startTime: new Date(),
      startReading: parseFloat(startReading),
      startReadingImage,
      status: "Active",
      createdBy: req.user._id,
    };

    // Add assignment if provided
    if (assignmentId) {
      shiftData.assignment = assignmentId;
    }

    const shift = await Shift.create(shiftData);
    console.log("✅ Shift created successfully:", shift._id);

    // Update nozzleman's total shifts
    await Nozzleman.findByIdAndUpdate(nozzleman, {
      $inc: { totalShifts: 1 },
    });

    // Populate the shift for response
    const populatedShift = await Shift.findById(shift._id)
      .populate("nozzleman", "name employeeId mobile")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Shift started successfully",
      shift: populatedShift
    });

  } catch (error) {
    console.error("❌ Error in startShift:", error);
    
    // More specific error handling
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Duplicate shift ID or unique constraint violation"
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to start shift",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    End shift
// @route   PUT /api/shifts/end/:id
// @access  Private
export const endShift = asyncHandler(async (req, res) => {
  try {
    const { 
      endReading, 
      endReadingImage, 
      cashCollected, 
      phonePeSales = 0, 
      posSales = 0, 
      otpSales = 0, 
      creditSales = 0,
      expenses = 0,
      cashDeposit = 0,
      meterReadingHSD = { opening: 0, closing: 0 },
      meterReadingPetrol = { opening: 0, closing: 0 },
      notes 
    } = req.body;

    console.log("🔍 Ending shift:", req.params.id);
    console.log("💰 Cash collected:", cashCollected);

    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    if (shift.status !== "Active") {
      res.status(400);
      throw new Error("Shift is not active");
    }

    if (endReading === undefined || !endReadingImage) {
      res.status(400);
      throw new Error("Please provide end reading and reading proof image");
    }

    const fuelDispensed = parseFloat(endReading) - shift.startReading;

    if (fuelDispensed < 0) {
      res.status(400);
      throw new Error("End reading cannot be less than start reading");
    }

    // Update shift with all data
    shift.endTime = new Date();
    shift.endReading = parseFloat(endReading);
    shift.endReadingImage = endReadingImage;
    shift.fuelDispensed = fuelDispensed;
    shift.cashCollected = parseFloat(cashCollected) || 0;
    shift.phonePeSales = parseFloat(phonePeSales) || 0;
    shift.posSales = parseFloat(posSales) || 0;
    shift.otpSales = parseFloat(otpSales) || 0;
    shift.creditSales = parseFloat(creditSales) || 0;
    shift.expenses = parseFloat(expenses) || 0;
    shift.cashDeposit = parseFloat(cashDeposit) || 0;
    shift.meterReadingHSD = meterReadingHSD;
    shift.meterReadingPetrol = meterReadingPetrol;
    shift.notes = notes || "";
    shift.status = "Pending Approval";

    // Calculate cash in hand
    const totalSales = shift.cashCollected + shift.phonePeSales + shift.posSales + shift.otpSales + shift.creditSales;
    shift.cashInHand = totalSales - shift.expenses - shift.cashDeposit;

    const updatedShift = await shift.save();

    // Create cash handover record
    if (shift.cashCollected > 0) {
      console.log("💵 Creating cash handover record...");
      try {
        const cashHandover = await CashHandover.create({
          shift: shift._id,
          nozzleman: shift.nozzleman,
          amount: shift.cashCollected,
          status: "Pending",
          notes: `Cash collected from shift ${shift.shiftId}`
        });
        console.log("✅ Cash handover created:", cashHandover._id);
      } catch (error) {
        console.error("❌ Error creating cash handover:", error);
      }
    }

    // Update nozzle current reading
    await Nozzle.findByIdAndUpdate(shift.nozzle, {
      currentReading: shift.endReading,
      $inc: { totalDispensed: fuelDispensed }
    });

    // Update nozzleman statistics
    await Nozzleman.findByIdAndUpdate(shift.nozzleman, {
      $inc: {
        totalFuelDispensed: fuelDispensed
      }
    });

    const populatedShift = await Shift.findById(updatedShift._id)
      .populate("nozzleman", "name employeeId mobile")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("createdBy", "name email");

    res.json({
      message: "Shift ended successfully and sent for approval",
      shift: populatedShift
    });
  } catch (error) {
    console.error("Error in endShift:", error);
    res.status(500);
    throw new Error("Failed to end shift");
  }
});

// @desc    Verify shift (Supervisor approval)
// @route   PUT /api/shifts/verify/:id
// @access  Private (Supervisor/Admin)
export const verifyShift = asyncHandler(async (req, res) => {
  try {
    const { isApproved, auditNotes } = req.body;

    const shift = await Shift.findById(req.params.id);
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    if (shift.status !== "Pending Approval") {
      res.status(400);
      throw new Error("Shift is not pending approval");
    }

    if (isApproved) {
      shift.status = "Approved";
      shift.auditNotes = auditNotes;
      shift.auditedBy = req.user._id;
      shift.auditedAt = new Date();

      // Update nozzleman average cash handled
      const nozzleman = await Nozzleman.findById(shift.nozzleman);
      const totalSales = shift.cashCollected + shift.phonePeSales + shift.posSales + shift.otpSales + shift.creditSales;
      
      const newAverage = nozzleman.totalShifts > 0 
        ? (nozzleman.averageCashHandled * (nozzleman.totalShifts - 1) + totalSales) / nozzleman.totalShifts
        : totalSales;

      await Nozzleman.findByIdAndUpdate(shift.nozzleman, {
        averageCashHandled: newAverage
      });

    } else {
      shift.status = "Rejected";
      shift.auditNotes = auditNotes;
      shift.auditedBy = req.user._id;
      shift.auditedAt = new Date();
    }

    const updatedShift = await shift.save();

    const populatedShift = await Shift.findById(updatedShift._id)
      .populate("nozzleman", "name employeeId mobile")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("auditedBy", "name email");

    res.json({
      message: `Shift ${isApproved ? 'approved' : 'rejected'} successfully`,
      shift: populatedShift
    });
  } catch (error) {
    console.error("Error in verifyShift:", error);
    res.status(500);
    throw new Error("Failed to verify shift");
  }
});

// @desc    Update shift
// @route   PUT /api/shifts/:id
// @access  Private
export const updateShift = asyncHandler(async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    // Prevent updating completed or approved shifts
    if (["Completed", "Approved"].includes(shift.status)) {
      res.status(400);
      throw new Error(`Cannot update ${shift.status.toLowerCase()} shift`);
    }

    // Fields that can be updated
    const updatableFields = [
      'notes', 'cashCollected', 'phonePeSales', 'posSales', 
      'otpSales', 'creditSales', 'expenses', 'cashDeposit',
      'meterReadingHSD', 'meterReadingPetrol'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        shift[field] = req.body[field];
      }
    });

    // Recalculate cash in hand if relevant fields are updated
    if (req.body.cashCollected !== undefined || req.body.expenses !== undefined || req.body.cashDeposit !== undefined) {
      const totalSales = shift.cashCollected + shift.phonePeSales + shift.posSales + shift.otpSales + shift.creditSales;
      shift.cashInHand = totalSales - shift.expenses - shift.cashDeposit;
    }

    const updatedShift = await shift.save();

    const populatedShift = await Shift.findById(updatedShift._id)
      .populate("nozzleman", "name employeeId mobile")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("createdBy", "name email")
      .populate("auditedBy", "name email");

    res.json({
      message: "Shift updated successfully",
      shift: populatedShift
    });
  } catch (error) {
    console.error("Error in updateShift:", error);
    res.status(500);
    throw new Error("Failed to update shift");
  }
});

// @desc    Get shifts for specific nozzleman
// @route   GET /api/shifts/nozzleman/:nozzlemanId
// @access  Private
export const getShiftsByNozzleman = asyncHandler(async (req, res) => {
  try {
    const { nozzlemanId } = req.params;
    const { status, startDate, endDate } = req.query;

    let filter = { nozzleman: nozzlemanId };

    if (status) filter.status = status;

    // Date range filter
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.startTime.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.startTime.$lte = end;
      }
    }

    const shifts = await Shift.find(filter)
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("auditedBy", "name email")
      .sort({ startTime: -1 });

    // Calculate statistics
    const totalFuel = shifts.reduce((sum, shift) => sum + (shift.fuelDispensed || 0), 0);
    const totalCash = shifts.reduce((sum, shift) => sum + (shift.cashCollected || 0), 0);
    const completedShifts = shifts.filter(shift => shift.status === "Approved").length;

    res.json({
      shifts,
      statistics: {
        totalShifts: shifts.length,
        completedShifts,
        totalFuelDispensed: totalFuel,
        totalCashCollected: totalCash
      }
    });
  } catch (error) {
    console.error("Error in getShiftsByNozzleman:", error);
    res.status(500);
    throw new Error("Failed to fetch nozzleman shifts");
  }
});

// @desc    Get current active shift for nozzleman
// @route   GET /api/shifts/active/nozzleman
// @access  Private (Nozzleman only)
export const getActiveShift = asyncHandler(async (req, res) => {
  try {
    const nozzlemanId = req.user.nozzlemanProfile;

    if (!nozzlemanId) {
      res.status(403);
      throw new Error("No nozzleman profile found");
    }

    const activeShift = await Shift.findOne({
      nozzleman: nozzlemanId,
      status: "Active"
    })
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType currentReading");

    if (!activeShift) {
      return res.json({ 
        hasActiveShift: false,
        message: "No active shift found"
      });
    }

    res.json({
      hasActiveShift: true,
      shift: activeShift
    });
  } catch (error) {
    console.error("Error in getActiveShift:", error);
    res.status(500);
    throw new Error("Failed to fetch active shift");
  }
});

// @desc    Cancel shift
// @route   PUT /api/shifts/cancel/:id
// @access  Private (Admin/Supervisor)
export const cancelShift = asyncHandler(async (req, res) => {
  try {
    const { reason } = req.body;

    const shift = await Shift.findById(req.params.id);
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    if (shift.status === "Completed" || shift.status === "Approved") {
      res.status(400);
      throw new Error("Cannot cancel completed or approved shift");
    }

    shift.status = "Cancelled";
    shift.auditNotes = `Cancelled: ${reason}`;
    shift.auditedBy = req.user._id;
    shift.auditedAt = new Date();

    const updatedShift = await shift.save();

    res.json({
      message: "Shift cancelled successfully",
      shift: updatedShift
    });
  } catch (error) {
    console.error("Error in cancelShift:", error);
    res.status(500);
    throw new Error("Failed to cancel shift");
  }
});