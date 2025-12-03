// controllers/creditController.js - UPDATED WITH SYNC FUNCTION
import Customer from "../models/Customer.js";
import Ledger from "../models/Ledger.js";
import asyncHandler from "express-async-handler";

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getCustomers = asyncHandler(async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500);
    throw new Error("Failed to fetch customers");
  }
});

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  
  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  res.json(customer);
});

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = asyncHandler(async (req, res) => {
  const { name, mobile, email, creditLimit, address, status } = req.body;

  if (!name || !mobile || !creditLimit) {
    res.status(400);
    throw new Error("Please provide name, mobile, and credit limit");
  }

  // Check if customer with same mobile already exists
  const existingCustomer = await Customer.findOne({ mobile });
  if (existingCustomer) {
    res.status(400);
    throw new Error("Customer with this mobile number already exists");
  }

  const customer = await Customer.create({
    name,
    mobile,
    email,
    creditLimit,
    address,
    status: status || "Active",
    balance: 0,
    createdBy: req.user._id,
  });

  res.status(201).json(customer);
});

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  // Check if mobile is being updated and if it conflicts with existing customer
  if (req.body.mobile && req.body.mobile !== customer.mobile) {
    const existingCustomer = await Customer.findOne({ 
      mobile: req.body.mobile,
      _id: { $ne: customer._id }
    });
    if (existingCustomer) {
      res.status(400);
      throw new Error("Another customer with this mobile number already exists");
    }
  }

  Object.assign(customer, req.body);
  const updatedCustomer = await customer.save();

  res.json(updatedCustomer);
});

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private
export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  // Check if customer has outstanding balance
  if (customer.balance > 0) {
    res.status(400);
    throw new Error("Cannot delete customer with outstanding balance");
  }

  await Customer.findByIdAndDelete(req.params.id);
  res.json({ message: "Customer removed successfully" });
});

// @desc    Record payment
// @route   POST /api/customers/:id/payment
// @access  Private
export const recordPayment = asyncHandler(async (req, res) => {
  const { amount, paymentDate, notes } = req.body;

  console.log("🟡 Payment request received:", { 
    customerId: req.params.id, 
    amount, 
    paymentDate, 
    notes 
  });

  if (!amount || amount <= 0) {
    res.status(400);
    throw new Error("Please provide a valid payment amount");
  }

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  console.log("🟡 Customer found:", { 
    name: customer.name, 
    currentBalance: customer.balance 
  });

  // Update customer balance (ALLOW NEGATIVE VALUES FOR ADVANCE PAYMENTS)
  const oldBalance = customer.balance;
  customer.balance = oldBalance - amount;
  
  console.log("🟡 Balance update:", { 
    oldBalance, 
    newBalance: customer.balance 
  });

  await customer.save();

  // Create ledger entry
  const ledgerEntry = await Ledger.create({
    customer: customer._id,
    type: "Payment",
    amount: amount,
    balance: customer.balance,
    description: notes || `Payment received from ${customer.name}`,
    reference: `PAY-${Date.now()}`,
    createdBy: req.user._id,
    date: paymentDate ? new Date(paymentDate) : new Date()
  });

  console.log("🟡 Ledger entry created:", ledgerEntry);

  res.status(200).json({
    success: true,
    message: "Payment recorded successfully",
    customer,
    ledgerEntry,
    oldBalance,
    newBalance: customer.balance
  });
});

// @desc    Sync a credit sale record from a shift
// @route   POST /api/customers/sync-sale
// @access  Private (Admin/Supervisor)
export const syncCreditSale = asyncHandler(async (req, res) => {
  const { customerId, amount, shiftId, date, vehicleNumber, notes } = req.body;

  console.log("🟡 Credit sale sync request:", req.body);

  if (!customerId || !amount || amount <= 0) {
    res.status(400);
    throw new Error("Customer ID and valid Amount are required");
  }

  const customer = await Customer.findById(customerId);
  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  // Check credit limit
  const newBalance = (customer.balance || 0) + Number(amount);
  if (newBalance > customer.creditLimit) {
    res.status(400);
    throw new Error(`Credit limit exceeded. Current balance: ${customer.balance}, Limit: ${customer.creditLimit}`);
  }

  // 1. Update Customer Balance (Increase balance for sales)
  const oldBalance = customer.balance;
  customer.balance = newBalance;
  customer.lastTransactionDate = new Date();
  await customer.save();

  console.log("🟡 Customer balance updated:", { 
    customer: customer.name, 
    oldBalance, 
    newBalance: customer.balance 
  });

  // 2. Create Ledger Entry
  const ledgerEntry = await Ledger.create({
    customer: customerId,
    shift: shiftId || null,
    transactionType: "Sale",
    amount: Number(amount),
    totalAmount: Number(amount),
    balanceAfter: customer.balance,
    description: notes || `Credit sale recorded from shift`,
    vehicleNumber: vehicleNumber || "",
    transactionDate: date ? new Date(date) : new Date(),
    createdBy: req.user._id,
    status: "Completed",
    referenceNumber: `SALE-${Date.now().toString().slice(-8)}`
  });

  console.log("✅ Ledger entry created:", ledgerEntry._id);

  res.status(201).json({
    success: true,
    message: "Credit sale synced successfully",
    customer: {
      _id: customer._id,
      name: customer.name,
      balance: customer.balance,
      creditLimit: customer.creditLimit
    },
    ledgerEntry,
    oldBalance,
    newBalance: customer.balance
  });
});