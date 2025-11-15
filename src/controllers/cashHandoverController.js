// controllers/cashHandoverController.js
import CashHandover from "../models/CashHandover.js";
import Sale from "../models/Sale.js";
import Shift from "../models/Shift.js";
import asyncHandler from "express-async-handler";

// @desc    Get all cash handovers
// @route   GET /api/cash-handovers
// @access  Private
export const getCashHandovers = asyncHandler(async (req, res) => {
  try {
    console.log("🔍 Fetching cash handovers...");
    const handovers = await CashHandover.find()
      .populate("shift", "shiftId startTime endTime")
      .populate("nozzleman", "name employeeId")
      .populate("verifiedBy", "name")
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${handovers.length} cash handovers`);
    console.log("Handovers:", handovers);
    
    res.json(handovers);
  } catch (error) {
    console.error("❌ Error fetching cash handovers:", error);
    res.status(500);
    throw new Error("Failed to fetch cash handovers");
  }
});

export const verifyCashHandover = asyncHandler(async (req, res) => {
  const handover = await CashHandover.findById(req.params.id)
    .populate("shift")
    .populate("nozzleman");

  if (!handover) {
    res.status(404);
    throw new Error("Cash handover not found");
  }

  if (handover.status !== "Pending") {
    res.status(400);
    throw new Error("Cash handover already processed");
  }

  console.log("✅ Verifying cash handover:", handover._id);

  const shift = await Shift.findById(handover.shift._id)
    .populate("nozzle");

  if (!shift) {
    res.status(404);
    throw new Error("Associated shift not found");
  }

  if (!shift.nozzle) {
    res.status(400);
    throw new Error("No nozzle associated with this shift");
  }

  // Generate transaction ID
  const count = await Sale.countDocuments();
  const transactionId = `TXN-${String(count + 1).padStart(6, "0")}`;

  console.log("🔄 Creating sale record...");

  // Create sale record with proper data
  const sale = await Sale.create({
    transactionId,
    shift: handover.shift._id,
    nozzle: shift.nozzle._id,
    liters: shift.fuelDispensed,
    price: shift.nozzle.rate,
    totalAmount: handover.amount,
    paymentMode: "Cash",
    verifiedBy: req.user._id,
  });

  console.log("✅ Sale created:", sale._id);

  // Update cash handover status
  handover.status = "Verified";
  handover.verifiedBy = req.user._id;
  handover.verifiedAt = new Date();
  await handover.save();

  console.log("✅ Cash handover verified");

  // Populate the sale for response (only fields that exist)
  const populatedSale = await Sale.findById(sale._id)
    .populate("nozzle", "number fuelType")
    .populate("verifiedBy", "name");

  res.json({
    message: "Cash handover verified and sale created",
    sale: populatedSale,
    handover
  });
});

// @desc    Reject cash handover
// @route   PUT /api/cash-handovers/:id/reject
// @access  Private
export const rejectCashHandover = asyncHandler(async (req, res) => {
  const { notes } = req.body;

  const handover = await CashHandover.findById(req.params.id);

  if (!handover) {
    res.status(404);
    throw new Error("Cash handover not found");
  }

  if (handover.status !== "Pending") {
    res.status(400);
    throw new Error("Cash handover already processed");
  }

  handover.status = "Rejected";
  handover.notes = notes || "Rejected by manager";
  await handover.save();

  res.json({ message: "Cash handover rejected", handover });
});