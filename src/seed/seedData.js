import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Pump from "../models/Pump.js";
import Nozzle from "../models/Nozzle.js";
import Tank from "../models/Tank.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import Price from "../models/Price.js";
import bcrypt from "bcrypt";

dotenv.config();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected for seeding...");
};

const seed = async () => {
  try {
    // Clear collections
    await User.deleteMany();
    await Pump.deleteMany();
    await Nozzle.deleteMany();
    await Tank.deleteMany();
    await Product.deleteMany();
    await Customer.deleteMany();
    await Price.deleteMany();

    // Users
    const hashedPassword = await bcrypt.hash("password123", 10);
    const users = await User.insertMany([
      { name: "Admin User", email: "admin@example.com", password: hashedPassword, role: "Admin" },
      { name: "Manager User", email: "manager@example.com", password: hashedPassword, role: "Manager" },
      { name: "Nozzleman User", email: "nozzleman@example.com", password: hashedPassword, role: "Nozzleman" },
      { name: "Auditor User", email: "auditor@example.com", password: hashedPassword, role: "Auditor" },
    ]);

    // Pumps
const pump1 = await Pump.create({ name: "Pump 1", status: "Active" });

// Nozzles
const nozzle1 = await Nozzle.create({
  number: "1",          // required field in schema
  pump: pump1._id,
  assignedTo: users.find(u => u.role === "Nozzleman")._id, // optional
  calibrationLog: [],
});
const nozzle2 = await Nozzle.create({
  number: "2",
  pump: pump1._id,
  assignedTo: null,
  calibrationLog: [],
});

    // Tanks
    const tank1 = await Tank.create({ name: "Petrol Tank", type: "Petrol", capacity: 5000, openingStock: 3000, currentStock: 3000 });

    // Products
    const petrol = await Product.create({ name: "Petrol", type: "Fuel" });

    // Prices
    await Price.create({ product: petrol._id, price: 100, date: new Date() });

    // Customers
    await Customer.create({ name: "John Doe", email: "john@example.com", creditLimit: 5000, balance: 0 });

    console.log("Seed data inserted successfully!");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

connectDB().then(seed);
