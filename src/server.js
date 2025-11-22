import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import pumpRoutes from "./routes/pumpRoutes.js";
import shiftRoutes from "./routes/shiftRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import creditRoutes from "./routes/creditRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import priceRoutes from "./routes/priceRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import cookieParser from "cookie-parser";
import nozzleRoutes from "./routes/nozzleRoutes.js";
import nozzlemanRoutes from "./routes/nozzlemanRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import cashHandoverRoutes from "./routes/cashHandoverRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import backupRoutes from "./routes/backupRoutes.js"; // Make sure this import is correct
import nozzlemanDashboardRoutes from "./routes/nozzlemanDashboardRoutes.js";
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import path from "./models/User.js";
import tankConfigRoutes from "./routes/tankConfigRoutes.js";
import tankRoutes from "./routes/tankRoutes.js";
import nozzlemanSalesRoutes from './routes/nozzlemanSalesRoutes.js';

const app = express();

// CORS configuration - UPDATED
app.use(cors({
  origin: [
    "https://pumpmanager.netlify.app", // Your Netlify domain
    "http://localhost:5173", 
    "http://localhost:8080", 
    "http://127.0.0.1:5173"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Additional CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next();
});

app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/pumps", pumpRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/cash-handovers", cashHandoverRoutes);
app.use("/api/customers", creditRoutes);
app.use("/api/expenses", expenseRoutes);
app.use('/api/products', productRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/nozzles", nozzleRoutes);
app.use("/api/nozzlemen", nozzlemanRoutes); 
app.use("/api/assignments", assignmentRoutes);
app.use("/api/backups", backupRoutes); // FIXED: Use app.use()
app.use("/api/nozzleman", nozzlemanDashboardRoutes);
app.use("/api/tanks/config", tankConfigRoutes); // For admin management
app.use("/api/tanks", tankRoutes); // For general tank operations
app.use('/api/nozzleman-sales', nozzlemanSalesRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`💾 Backup system initialized - Daily backups at 2 AM`);
  });
});