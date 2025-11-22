import User from "../models/User.js";
import asyncHandler from "express-async-handler";
import bcrypt from "bcrypt";

// @desc Get all users
// @route GET /api/users
// @access Admin
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

// @desc Get single user
// @route GET /api/users/:id
// @access Admin
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) throw new Error("User not found");
  res.json(user);
});

// @desc Update user
// @route PUT /api/users/:id
// @access Admin
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new Error("User not found");

  const { name, email, role } = req.body;
  user.name = name || user.name;
  user.email = email || user.email;
  user.role = role || user.role;

  const updatedUser = await user.save();
  res.json({ _id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role });
});

// @desc Delete user
// @route DELETE /api/users/:id
// @access Admin
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new Error("User not found");
  await user.remove();
  res.json({ message: "User removed" });
});

// @desc Create a new user
// @route POST /api/users
// @access Admin
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User with this email already exists" });
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role,
  });

  res.status(201).json({
    message: "User created successfully",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// @desc Change user password
// @route PATCH /api/users/:id/change-password
// @access Private (User can change own password, Admin can change any password)
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.params.id;

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Check if user is changing their own password or if admin is changing it
  const isOwnPasswordChange = req.user._id.toString() === userId;
  const isAdmin = req.user.role === 'admin';

  // If user is changing their own password, require current password
  if (isOwnPasswordChange) {
    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }

    try {
      await user.changePassword(currentPassword, newPassword);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  } 
  // If admin is changing another user's password, no current password required
  else if (isAdmin) {
    user.password = newPassword;
    await user.save();
  } 
  // If user is trying to change someone else's password without admin privileges
  else {
    return res.status(403).json({ message: "Not authorized to change this user's password" });
  }

  res.json({
    message: "Password changed successfully",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// @desc Change own password (convenience endpoint)
// @route PATCH /api/users/change-my-password
// @access Private
export const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      message: "Current password and new password are required" 
    });
  }

  // Get user with password field
  const user = await User.findById(req.user._id).select('+password');
  
  try {
    await user.changePassword(currentPassword, newPassword);
    
    res.json({
      message: "Your password has been changed successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});