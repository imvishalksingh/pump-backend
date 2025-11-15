import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Petrol', 'Diesel', 'CNG', 'Lubricant', 'Accessory'],
    default: 'Petrol'
  },
  currentPrice: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['Liter', 'Kg', 'Piece', 'Unit'],
    default: 'Liter'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Virtual for lastUpdated (same as updatedAt)
productSchema.virtual('lastUpdated').get(function() {
  return this.updatedAt;
});

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });

export default mongoose.model("Product", productSchema);