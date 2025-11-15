// controllers/creditController.js
import Customer from "../models/Customer.js";
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

  // REMOVE THIS VALIDATION - Allow payments even when balance is zero
  // if (amount > customer.balance) {
  //   res.status(400);
  //   throw new Error("Payment amount cannot exceed outstanding balance");
  // }

  // Update customer balance (ALLOW NEGATIVE VALUES FOR ADVANCE PAYMENTS)
  const oldBalance = customer.balance;
  customer.balance = oldBalance - amount;
  
  console.log("🟡 Balance update:", { 
    oldBalance, 
    newBalance: customer.balance 
  });

  await customer.save();

  // Create ledger entry
  const Ledger = (await import("../models/ledger.js")).default;
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