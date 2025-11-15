// controllers/ledgerController.js
import Ledger from "../models/ledger.js";
import Customer from "../models/Customer.js";
import asyncHandler from "express-async-handler";

// @desc    Get ledger entries for a customer
// @route   GET /api/ledger/:customerId
// @access  Private
export const getCustomerLedger = asyncHandler(async (req, res) => {
  const { customerId } = req.params;

  const customer = await Customer.findById(customerId);
  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  const ledgerEntries = await Ledger.find({ customer: customerId })
    .populate("createdBy", "name")
    .sort({ createdAt: -1 });

  res.json({
    customer,
    ledgerEntries,
    currentBalance: customer.balance
  });
});

// @desc    Get all ledger entries
// @route   GET /api/ledger
// @access  Private
export const getAllLedger = asyncHandler(async (req, res) => {
  const ledgerEntries = await Ledger.find()
    .populate("customer", "name mobile")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 });

  res.json(ledgerEntries);
});