// models/Setting.js
import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, "Company name is required"],
    default: "ABC Petrol Pump"
  },
  GST: {
    type: String,
    required: [true, "GST number is required"],
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Please enter a valid GST number"],
    default: "22AAAAA0000A1Z5"
  },
  logoUrl: String,
  address: {
    type: String,
    default: "123 Main Road, Mumbai, Maharashtra - 400001"
  },
  phone: {
    type: String,
    default: "+91 98765 43210"
  },
  email: {
    type: String,
    default: "info@abcpump.com"
  },
  taxSettings: {
    cgst: {
      type: Number,
      default: 9
    },
    sgst: {
      type: Number,
      default: 9
    },
    cess: {
      type: Number,
      default: 0
    }
  },
  preferences: {
    units: {
      fuel: {
        type: String,
        default: "liters"
      },
      currency: {
        type: String,
        default: "inr"
      }
    },
    dateFormat: {
      type: String,
      default: "dd-mm-yyyy"
    },
    timeFormat: {
      type: String,
      default: "24"
    }
  },
  lastBackup: Date
}, { 
  timestamps: true 
});

// Ensure only one settings document exists
settingSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Setting = mongoose.model("Setting", settingSchema);
export default Setting;