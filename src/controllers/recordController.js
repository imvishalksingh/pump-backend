// controllers/recordController.js - NEW FILE
import Shift from "../models/Shift.js";
import asyncHandler from "express-async-handler";

// @desc    Get records for a shift
// @route   GET /api/shifts/:shiftId/records
// @access  Private
export const getShiftRecords = asyncHandler(async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { type } = req.query; // 'cash', 'phonepe', 'pos', 'fuel', 'testing', 'expenses'

    const shift = await Shift.findById(shiftId).select('cashSalesRecords phonePeRecords posRecords fuelRecords testingRecords expenseRecords');
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    let records = [];
    switch(type) {
      case 'cash':
        records = shift.cashSalesRecords || [];
        break;
      case 'phonepe':
        records = shift.phonePeRecords || [];
        break;
      case 'pos':
        records = shift.posRecords || [];
        break;
      case 'fuel':
        records = shift.fuelRecords || [];
        break;
      case 'testing':
        records = shift.testingRecords || [];
        break;
      case 'expenses':
        records = shift.expenseRecords || [];
        break;
      default:
        res.status(400);
        throw new Error("Invalid record type");
    }

    res.json({
      success: true,
      records,
      count: records.length,
      shiftId
    });
  } catch (error) {
    console.error("Error in getShiftRecords:", error);
    res.status(500);
    throw new Error("Failed to fetch records");
  }
});

// @desc    Add a record to a shift
// @route   POST /api/shifts/:shiftId/records
// @access  Private
export const addShiftRecord = asyncHandler(async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { type, ...recordData } = req.body;

    console.log("📝 Adding record to shift:", { shiftId, type, recordData });

    const shift = await Shift.findById(shiftId);
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    // Validate required fields based on type
    const validationErrors = [];
    
    switch(type) {
      case 'cash':
        if (!recordData.amount || recordData.amount <= 0) {
          validationErrors.push("Amount is required and must be greater than 0");
        }
        if (!recordData.time) {
          validationErrors.push("Time is required");
        }
        break;
      case 'fuel':
        if (!recordData.liters || recordData.liters <= 0) {
          validationErrors.push("Liters is required and must be greater than 0");
        }
        if (!recordData.time) {
          validationErrors.push("Time is required");
        }
        if (!recordData.fuelType) {
          validationErrors.push("Fuel type is required");
        }
        break;
      case 'phonepe':
      case 'pos':
        if (!recordData.amount || recordData.amount <= 0) {
          validationErrors.push("Amount is required and must be greater than 0");
        }
        if (!recordData.time) {
          validationErrors.push("Time is required");
        }
        if (!recordData.transactionId) {
          validationErrors.push("Transaction ID is required");
        }
        break;
      case 'testing':
        if (!recordData.liters || recordData.liters <= 0) {
          validationErrors.push("Liters is required and must be greater than 0");
        }
        if (!recordData.time) {
          validationErrors.push("Time is required");
        }
        if (!recordData.testedBy) {
          validationErrors.push("Tested by is required");
        }
        break;
      case 'expenses':
        if (!recordData.amount || recordData.amount <= 0) {
          validationErrors.push("Amount is required and must be greater than 0");
        }
        if (!recordData.time) {
          validationErrors.push("Time is required");
        }
        if (!recordData.category) {
          validationErrors.push("Category is required");
        }
        if (!recordData.description) {
          validationErrors.push("Description is required");
        }
        break;
      default:
        res.status(400);
        throw new Error("Invalid record type");
    }

    if (validationErrors.length > 0) {
      res.status(400);
      throw new Error(validationErrors.join(", "));
    }

    // Prepare update object
    const updateField = {
      cash: 'cashSalesRecords',
      phonepe: 'phonePeRecords',
      pos: 'posRecords',
      fuel: 'fuelRecords',
      testing: 'testingRecords',
      expenses: 'expenseRecords'
    }[type];

    const update = {
      $push: { [updateField]: recordData }
    };

    // Also update the total in shift
    if (type === 'cash') {
      update.$inc = { cashCollected: recordData.amount };
    } else if (type === 'phonepe') {
      update.$inc = { phonePeSales: recordData.amount };
    } else if (type === 'pos') {
      update.$inc = { posSales: recordData.amount };
    } else if (type === 'fuel') {
      update.$inc = { fuelDispensed: recordData.liters };
    } else if (type === 'testing') {
      update.$inc = { testingFuel: recordData.liters };
    } else if (type === 'expenses') {
      update.$inc = { expenses: recordData.amount };
    }

    const updatedShift = await Shift.findByIdAndUpdate(
      shiftId,
      update,
      { new: true }
    );

    res.json({
      success: true,
      message: "Record added successfully",
      record: recordData,
      shift: {
        _id: updatedShift._id,
        [updateField]: updatedShift[updateField]
      }
    });

  } catch (error) {
    console.error("Error in addShiftRecord:", error);
    res.status(500);
    throw new Error("Failed to add record");
  }
});

// @desc    Update records in bulk (for calculator save)
// @route   PUT /api/shifts/:shiftId/records/bulk
// @access  Private
export const updateShiftRecordsBulk = asyncHandler(async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { type, records, total } = req.body;

    console.log("📊 Updating records in bulk:", { shiftId, type, recordCount: records?.length, total });

    const shift = await Shift.findById(shiftId);
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    const updateField = {
      cash: 'cashSalesRecords',
      phonepe: 'phonePeRecords',
      pos: 'posRecords',
      fuel: 'fuelRecords',
      testing: 'testingRecords',
      expenses: 'expenseRecords'
    }[type];

    const totalField = {
      cash: 'cashCollected',
      phonepe: 'phonePeSales',
      pos: 'posSales',
      fuel: 'fuelDispensed',
      testing: 'testingFuel',
      expenses: 'expenses'
    }[type];

    const update = {
      [updateField]: records || []
    };

    // Only update total if provided
    if (total !== undefined) {
      update[totalField] = total;
    }

    const updatedShift = await Shift.findByIdAndUpdate(
      shiftId,
      { $set: update },
      { new: true }
    );

    res.json({
      success: true,
      message: "Records updated successfully",
      records: updatedShift[updateField],
      total: updatedShift[totalField]
    });

  } catch (error) {
    console.error("Error in updateShiftRecordsBulk:", error);
    res.status(500);
    throw new Error("Failed to update records");
  }
});