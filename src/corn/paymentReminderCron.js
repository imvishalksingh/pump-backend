// cron/paymentReminderCron.js
import cron from "node-cron";
import Customer from "../models/Customer.js";
import Ledger from "../models/Ledger.js";
import { sendSMSAlert, sendEmailStatement } from "../utils/notificationService.js";

// Run daily at 10 AM
cron.schedule("0 10 * * *", async () => {
  console.log("🔄 Running payment reminder cron job...");
  
  try {
    // Find customers with overdue payments
    const overdueCustomers = await Ledger.aggregate([
      {
        $match: {
          transactionType: "Sale",
          status: "Completed",
          dueDate: { $lt: new Date() }
        }
      },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customer"
        }
      },
      { $unwind: "$customer" },
      {
        $match: {
          "customer.status": "Active",
          "customer.sendSMSAlerts": true
        }
      },
      {
        $group: {
          _id: "$customer._id",
          customer: { $first: "$customer" },
          overdueAmount: { $sum: "$balanceAfter" },
          oldestDueDate: { $min: "$dueDate" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Send reminders
    for (const item of overdueCustomers) {
      const overdueDays = Math.ceil((new Date() - item.oldestDueDate) / (1000 * 60 * 60 * 24));
      
      const message = `Dear ${item.customer.name}, your payment of ₹${item.overdueAmount.toLocaleString()} is overdue by ${overdueDays} days. Please make payment at earliest.`;
      
      await sendSMSAlert(item.customer.mobile, message);
      
      if (item.customer.sendEmailStatements && item.customer.email) {
        await sendEmailStatement(item.customer.email, item.customer, {
          overdueAmount: item.overdueAmount,
          overdueDays,
          dueDate: item.oldestDueDate
        });
      }
    }

    console.log(`✅ Sent payment reminders to ${overdueCustomers.length} customers`);
  } catch (error) {
    console.error("❌ Error in payment reminder cron:", error);
  }
});

// Run monthly on 1st at 9 AM for statements
cron.schedule("0 9 1 * *", async () => {
  console.log("🔄 Running monthly statement generation...");
  
  try {
    const activeCustomers = await Customer.find({ 
      status: "Active",
      sendEmailStatements: true,
      email: { $ne: null }
    });

    for (const customer of activeCustomers) {
      // Generate and send monthly statement
      await sendEmailStatement(customer.email, customer, {
        month: new Date().toLocaleString('default', { month: 'long' }),
        year: new Date().getFullYear()
      });
    }

    console.log(`✅ Sent monthly statements to ${activeCustomers.length} customers`);
  } catch (error) {
    console.error("❌ Error in monthly statement cron:", error);
  }
});