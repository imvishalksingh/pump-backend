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




// Create a new user
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
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
  } catch (err) {
    res.status(500).json({ message: "Error creating user", error: err.message });
  }
};
