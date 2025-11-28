import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import dotenv from "dotenv";
import Nozzleman from "../models/NozzleMan.js";
dotenv.config();

// Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

// @desc Register new user with invitation
// @route POST /api/auth/register
// @access Public
export const register = asyncHandler(async (req, res) => {
  console.log("Register request received:", req.body);
  
  const { name, email, password, invitationToken } = req.body;

  if (!name || !email || !password || !invitationToken) {
    res.status(400);
    throw new Error("Please provide name, email, password and invitation token");
  }

  // Validate invitation
  const invitation = await Invitation.findOne({ 
    email: email.toLowerCase(),
    token: invitationToken,
    used: false,
    expiresAt: { $gt: new Date() }
  });

  if (!invitation) {
    res.status(400);
    throw new Error("Invalid, expired, or already used invitation token");
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Create user with role from invitation
  const user = await User.create({ 
    name, 
    email, 
    password, 
    role: invitation.role
  });

  // Mark invitation as used
  invitation.used = true;
  invitation.usedAt = new Date();
  await invitation.save();

  console.log("User created via invitation:", user.email, "Role:", user.role);

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// In your authController.js - Update login function
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log("Login attempt for:", email);

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  // Find user and include password
  const user = await User.findOne({ email })
    .select('+password')
    .populate('nozzlemanProfile'); // ADD THIS LINE
  
  if (!user) {
    console.log("No user found with email:", email);
    res.status(401);
    throw new Error("Invalid email or password");
  }

  if (user.status !== "active") {
    res.status(401);
    throw new Error("Account suspended. Please contact administrator.");
  }

  try {
    const isPasswordMatch = await user.matchPassword(password);
    
    if (isPasswordMatch) {
      console.log("Login successful for:", user.email);
      
      const userResponse = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        nozzlemanProfile: user.nozzlemanProfile, // ADD THIS LINE
        token: generateToken(user._id, user.role),
      };

      res.status(200).json(userResponse);
    } else {
      console.log("Password mismatch for:", user.email);
      res.status(401);
      throw new Error("Invalid email or password");
    }
  } catch (error) {
    console.log("Password comparison error:", error.message);
    res.status(401);
    throw new Error("Invalid email or password");
  }
});
// @desc Logout user
// @route POST /api/auth/logout
// @access Public
export const logout = (req, res) => {
  res.status(200).json({ message: "Logged out successfully" });
};

// @desc Check invitation validity
// @route GET /api/auth/invitation/:token
// @access Public
export const checkInvitation = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { email } = req.query;

  console.log("🔍 Checking invitation:", { token, email });

  if (!token || !email) {
    res.status(400);
    throw new Error("Token and email are required");
  }

  const invitation = await Invitation.findOne({ 
    email: email.toLowerCase(),
    token: token,
    used: false,
    expiresAt: { $gt: new Date() }
  });

  if (!invitation) {
    res.status(404);
    throw new Error("Invalid or expired invitation");
  }

  console.log("✅ Invitation found:", invitation);

  res.status(200).json({
    valid: true,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt
  });
});

// @desc    Register nozzleman
// @route   POST /api/auth/register-nozzleman
// @access  Public
export const registerNozzleman = asyncHandler(async (req, res) => {
  const { name, email, password, mobile, shift } = req.body;

  if (!name || !email || !password || !mobile || !shift) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Create nozzleman profile first
  const nozzlemenCount = await Nozzleman.countDocuments();
  const employeeId = `NM-${String(nozzlemenCount + 1).padStart(3, "0")}`;

  const nozzleman = await Nozzleman.create({
    employeeId,
    name,
    mobile,
    shift,
    status: "Active",
    joinDate: new Date(),
  });

  // Create user account linked to nozzleman
  const user = await User.create({
    name,
    email,
    password,
    role: "nozzleman",
    nozzlemanProfile: nozzleman._id
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      nozzlemanProfile: nozzleman,
      token: generateToken(user._id),
    });
  } else {
    // Rollback: delete nozzleman if user creation fails
    await Nozzleman.findByIdAndDelete(nozzleman._id);
    res.status(400);
    throw new Error("Invalid user data");
  }
});