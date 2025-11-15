import express from "express";
import { getUsers, getUser, createUser, updateUser, deleteUser } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Admin only
router.use(protect);
router.use(authorize("admin"));

router.get("/", getUsers);
router.get("/:id", getUser);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
