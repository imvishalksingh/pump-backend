// middleware/creditLimitMiddleware.js
import Customer from "../models/Customer.js";

export const checkCreditLimit = async (req, res, next) => {
  try {
    const { customerId, amount } = req.body;
    
    if (!customerId || !amount) {
      return next();
    }

    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found"
      });
    }

    if (customer.status !== "Active") {
      return res.status(400).json({
        success: false,
        error: `Customer account is ${customer.status.toLowerCase()}`
      });
    }

    if (customer.availableCredit < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient credit available. Required: ₹${amount}, Available: ₹${customer.availableCredit}`
      });
    }

    req.customer = customer;
    next();
  } catch (error) {
    console.error("❌ Error in checkCreditLimit:", error);
    res.status(500);
    throw new Error("Credit limit check failed");
  }
};