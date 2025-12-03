// models/Shift.js - UPDATED WITH RECORDS
import mongoose from "mongoose";

const cashRecordSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  notes: String,
  billNumber: String,
  vehicleNumber: String,
  paymentMethod: {
    type: String,
    enum: ["cash", "card", "upi"],
    default: "cash"
  }
});

const digitalRecordSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  transactionId: {
    type: String,
    required: true
  },
  customerName: String,
  notes: String
});

const fuelRecordSchema = new mongoose.Schema({
  liters: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  vehicleNumber: String,
  fuelType: {
    type: String,
    enum: ["Petrol", "Diesel", "CNG"],
    required: true
  },
  nozzleNumber: String,
  notes: String
});

const testingRecordSchema = new mongoose.Schema({
  liters: {
    type: Number,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  testedBy: {
    type: String,
    required: true
  },
  notes: String
});

const expenseRecordSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  receiptNumber: String
});

const shiftSchema = mongoose.Schema(
  {
    shiftId: {
      type: String,
      required: true,
      unique: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
    },
    nozzleman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzleman",
      required: true,
    },
    pump: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pump",
      required: true,
    },
    nozzle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzle",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
    },
    startReading: {
      type: Number,
      required: true,
    },
    endReading: {
      type: Number,
    },
    startReadingImage: {
      type: String,
    },
    endReadingImage: {
      type: String,
    },
    fuelDispensed: {
      type: Number,
      default: 0,
    },
    testingFuel: {
      type: Number,
      default: 0,
    },
    cashCollected: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "Pending Approval", "Approved", "Rejected"],
      default: "Active",
    },
    notes: {
      type: String,
    },
    auditNotes: {
      type: String,
    },
    auditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    auditedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phonePeSales: {
      type: Number,
      default: 0,
    },
    posSales: {
      type: Number,
      default: 0,
    },
    otpSales: {
      type: Number,
      default: 0,
    },
    creditSales: {
      type: Number,
      default: 0,
    },
    isManualEntry: {
      type: Boolean,
      default: false
    },
    expenses: {
      type: Number,
      default: 0,
    },
    cashDeposit: {
      type: Number,
      default: 0,
    },
    meterReadingHSD: {
      opening: { type: Number, default: 0 },
      closing: { type: Number, default: 0 }
    },
    meterReadingPetrol: {
      opening: { type: Number, default: 0 },
      closing: { type: Number, default: 0 }
    },
    cashInHand: {
      type: Number,
      default: 0,
    },
    
    // ADD RECORDS ARRAYS
    cashSalesRecords: [cashRecordSchema],
    phonePeRecords: [digitalRecordSchema],
    posRecords: [digitalRecordSchema],
    fuelRecords: [fuelRecordSchema],
    testingRecords: [testingRecordSchema],
    expenseRecords: [expenseRecordSchema],
  },
  {
    timestamps: true,
  }
);

const Shift = mongoose.model("Shift", shiftSchema);
export default Shift;