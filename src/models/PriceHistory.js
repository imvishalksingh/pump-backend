import mongoose from "mongoose";

const priceHistorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  oldPrice: {
    type: Number,
    required: true,
    min: 0
  },
  newPrice: {
    type: Number,
    required: true,
    min: 0
  },
  updatedBy: {
    type: String,
    required: true,
    default: "Admin"
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  reason: {
    type: String,
    default: ""
  },
  effectiveDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Virtual for date (same as createdAt)
priceHistorySchema.virtual('date').get(function() {
  return this.createdAt;
});

// Ensure virtual fields are serialized
priceHistorySchema.set('toJSON', { virtuals: true });

export default mongoose.model("PriceHistory", priceHistorySchema);