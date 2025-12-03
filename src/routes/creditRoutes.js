// routes/creditRoutes.js - UPDATED WITH SYNC ROUTE
import express from "express";
import { 
  getCustomers, 
  getCustomer, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer, 
  recordPayment,
  syncCreditSale  // NEW IMPORT
} from "../controllers/creditController.js";
import { getCustomerLedger, getAllLedger } from "../controllers/ledgerController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Customer routes
router.get("/", getCustomers);
router.get("/:id", getCustomer);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

// Payment routes
router.post("/:id/payment", recordPayment);

// NEW: Credit sale sync route
router.post("/sync-sale", syncCreditSale);

// Ledger routes
router.get("/:id/ledger", getCustomerLedger);
router.get("/ledger/all", getAllLedger);

export default router;