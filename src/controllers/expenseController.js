import Expense from "../models/Expense.js";
import asyncHandler from "express-async-handler";

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
export const getExpenses = asyncHandler(async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    
    console.log("📊 Found expenses:", expenses.length);
    
    res.status(200).json(expenses);
  } catch (error) {
    console.error("❌ Error fetching expenses:", error);
    res.status(500).json({ 
      message: "Failed to fetch expenses",
      error: error.message 
    });
  }
});

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
export const getExpense = asyncHandler(async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ 
        message: "Expense not found" 
      });
    }

    res.status(200).json(expense);
  } catch (error) {
    console.error("❌ Error fetching expense:", error);
    res.status(500).json({ 
      message: "Failed to fetch expense",
      error: error.message 
    });
  }
});

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
export const createExpense = asyncHandler(async (req, res) => {
  try {
    const { category, amount, description, date } = req.body;

    console.log("🟡 Creating expense with data:", req.body);

    // Validation
    if (!category || !amount || amount <= 0) {
      return res.status(400).json({ 
        message: "Please provide valid category and amount" 
      });
    }

    const expense = await Expense.create({
      category,
      amount: Number(amount),
      description: description || "",
      date: date ? new Date(date) : new Date(),
      addedBy: req.user?.name || "Admin",
      status: "Pending"
    });

    console.log("✅ Expense created successfully:", expense);

    res.status(201).json(expense);
  } catch (error) {
    console.error("❌ Error creating expense:", error);
    res.status(500).json({ 
      message: "Failed to create expense",
      error: error.message 
    });
  }
});

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
export const updateExpense = asyncHandler(async (req, res) => {
  try {
    const { category, amount, description, date, status } = req.body;
    
    console.log("🟡 Updating expense:", req.params.id, req.body);

    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ 
        message: "Expense not found" 
      });
    }

    // Update fields if provided
    if (category) expense.category = category;
    if (amount) expense.amount = Number(amount);
    if (description !== undefined) expense.description = description;
    if (date) expense.date = new Date(date);
    if (status) expense.status = status;

    const updatedExpense = await expense.save();

    console.log("✅ Expense updated successfully:", updatedExpense);

    res.status(200).json(updatedExpense);
  } catch (error) {
    console.error("❌ Error updating expense:", error);
    res.status(500).json({ 
      message: "Failed to update expense",
      error: error.message 
    });
  }
});

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
export const deleteExpense = asyncHandler(async (req, res) => {
  try {
    console.log("🟡 Deleting expense:", req.params.id);

    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ 
        message: "Expense not found" 
      });
    }

    await Expense.findByIdAndDelete(req.params.id);

    console.log("✅ Expense deleted successfully");

    res.status(200).json({ 
      message: "Expense deleted successfully" 
    });
  } catch (error) {
    console.error("❌ Error deleting expense:", error);
    res.status(500).json({ 
      message: "Failed to delete expense",
      error: error.message 
    });
  }
});

// @desc    Approve expense
// @route   PUT /api/expenses/:id/approve
// @access  Private
export const approveExpense = asyncHandler(async (req, res) => {
  try {
    console.log("🟡 Approving expense:", req.params.id);

    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ 
        message: "Expense not found" 
      });
    }

    expense.status = "Approved";
    expense.approvedBy = req.user?.name || "Admin";
    
    const updatedExpense = await expense.save();

    console.log("✅ Expense approved successfully:", updatedExpense);

    res.status(200).json(updatedExpense);
  } catch (error) {
    console.error("❌ Error approving expense:", error);
    res.status(500).json({ 
      message: "Failed to approve expense",
      error: error.message 
    });
  }
});

// @desc    Reject expense
// @route   PUT /api/expenses/:id/reject
// @access  Private
export const rejectExpense = asyncHandler(async (req, res) => {
  try {
    console.log("🟡 Rejecting expense:", req.params.id);

    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ 
        message: "Expense not found" 
      });
    }

    expense.status = "Rejected";
    expense.approvedBy = req.user?.name || "Admin";
    
    const updatedExpense = await expense.save();

    console.log("✅ Expense rejected successfully:", updatedExpense);

    res.status(200).json(updatedExpense);
  } catch (error) {
    console.error("❌ Error rejecting expense:", error);
    res.status(500).json({ 
      message: "Failed to reject expense",
      error: error.message 
    });
  }
});

// expenseController.js में नया function जोड़ें
export const syncShiftExpense = asyncHandler(async (req, res) => {
  try {
    const { 
      category, 
      amount, 
      description, 
      date, 
      shiftId, 
      nozzlemanId, 
      shiftReference 
    } = req.body;

    console.log("🔄 Syncing shift expense:", req.body);

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        message: "Please provide a valid amount" 
      });
    }

    // Check if expense already exists for this shift
    const existingExpense = await Expense.findOne({ 
      shiftId: shiftId,
      amount: amount,
      date: date ? new Date(date) : new Date()
    });

    if (existingExpense) {
      console.log("ℹ️ Expense already exists for this shift");
      return res.status(200).json(existingExpense);
    }

    const expense = await Expense.create({
      category: category || "ShiftExpense",
      amount: Number(amount),
      description: description || "Expense from shift",
      date: date ? new Date(date) : new Date(),
      shiftId: shiftId || null,
      nozzlemanId: nozzlemanId || null,
      shiftReference: shiftReference || "",
      addedBy: "System Sync",
      status: "Approved", // Automatically approve system-synced expenses
      isShiftExpense: true
    });

    console.log("✅ Shift expense synced successfully:", expense);

    res.status(201).json(expense);
  } catch (error) {
    console.error("❌ Error syncing shift expense:", error);
    res.status(500).json({ 
      message: "Failed to sync shift expense",
      error: error.message 
    });
  }
});