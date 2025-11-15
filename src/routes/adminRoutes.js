import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { 
  createInvitation,
  getInvitations,
  resendInvitation,
  deleteInvitation,
  getUsers,
  updateUserRole,
  deleteUser
} from "../controllers/adminController.js";

const router = express.Router();

// All routes protected and only for admins
router.use(protect);
router.use(authorize("admin"));

// Invitation routes
router.post("/invitations", createInvitation);
router.get("/invitations", getInvitations);
router.post("/invitations/:id/resend", resendInvitation);
router.delete("/invitations/:id", deleteInvitation);

// User management routes
router.get("/users", getUsers);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

export default router;