// models/AuditReport.js
import mongoose from 'mongoose';

const auditReportSchema = new mongoose.Schema({
  reportDate: {
    type: Date,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  overallFindings: {
    type: String,
    required: true
  },
  recommendations: {
    type: String
  },
  isDataVerified: {
    type: Boolean,
    required: true
  },
  summary: {
    totalAudits: Number,
    approved: Number,
    rejected: Number
  },
  signedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure one report per day
auditReportSchema.index({ reportDate: 1 }, { unique: true });

export default mongoose.model('AuditReport', auditReportSchema);