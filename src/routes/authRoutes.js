import express from "express";
import asyncHandler from "express-async-handler"; // ADD THIS IMPORT
import User from "../models/User.js"; // ADD THIS IMPORT
import { 
  login, 
  register, 
  logout, 
  checkInvitation,
  registerNozzleman
} from "../controllers/authController.js";

const router = express.Router();

// TEMPORARY ROUTE - For first-time admin setup (remove after use)
router.post('/setup-admin', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Check if any admin already exists
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    return res.status(400).json({ 
      error: 'Admin user already exists. Use regular registration.' 
    });
  }

  // Create admin user directly
  const adminUser = await User.create({
    name: name || 'System Administrator',
    email: email || 'admin@gmail.com',
    password: password || 'admin123',
    role: 'admin',
    status: 'active'
  });

  res.status(201).json({
    message: 'Admin user created successfully',
    user: {
      _id: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role
    },
    loginCredentials: {
      email: adminUser.email,
      password: password || 'admin123'
    }
  });
}));

// TEMPORARY: Add this route to reset admin password
router.post('/reset-admin', asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  
  // Find the admin user
  const adminUser = await User.findOne({ email: "admin@gmail.com" });
  if (!adminUser) {
    return res.status(404).json({ error: 'Admin user not found' });
  }
  
  // Reset password
  adminUser.password = newPassword;
  await adminUser.save();
  
  res.json({ 
    success: true,
    message: 'Admin password reset successfully',
    credentials: {
      email: "admin@gmail.com",
      password: newPassword
    }
  });
}));

// Regular auth routes
router.post("/register", register);
router.post("/register-nozzleman", registerNozzleman);
router.post("/login", login);
router.post("/logout", logout);
router.get("/invitation/:token", checkInvitation);

export default router;
