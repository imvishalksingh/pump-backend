import express from "express";
import { 
  getUsers, 
  getUser, 
  createUser, 
  updateUser, 
  deleteUser,
  changePassword,
  changeMyPassword 
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Admin only routes
router.use(protect);
router.use(authorize("admin"));

router.get("/", getUsers);
router.get("/:id", getUser);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.patch("/:id/change-password", changePassword);

// Change own password route (accessible to all authenticated users)
router.patch("/change-my-password", protect, changeMyPassword);

export default router;