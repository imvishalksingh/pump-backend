import express from "express";
import { 
  login, 
  register, 
  logout, 
  checkInvitation ,
  registerNozzleman
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/register-nozzleman", registerNozzleman);
router.post("/login", login);
router.post("/logout", logout);
router.get("/invitation/:token", checkInvitation);

export default router;