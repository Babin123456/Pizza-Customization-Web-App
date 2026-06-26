import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  userProfile,
  getAllUsers,
  deleteUser,
  getUserLoyalty,
} from "../controllers/authController.js";

import protect from "../middlewares/authWebToken.js";
import admin from "../middlewares/adminMiddleware.js";
import { validateBody } from "../middlewares/validateMiddleware.js";

const router = express.Router();

const registerSchema = {
  name: { required: true, type: 'string', minLength: 2 },
  email: { 
    required: true, 
    type: 'string', 
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
    message: 'Please enter a valid email address.' 
  },
  password: { required: true, type: 'string', minLength: 6 }
};

const loginSchema = {
  email: { 
    required: true, 
    type: 'string', 
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
    message: 'Please enter a valid email address.' 
  },
  password: { required: true, type: 'string' }
};

// 🔐 Auth
router.post("/register", validateBody(registerSchema), registerUser);
router.post("/login", validateBody(loginSchema), loginUser);
router.post("/logout", protect, logoutUser);

// 👤 User
router.get("/profile", protect, userProfile);
router.get("/loyalty", protect, getUserLoyalty);

// 👑 Admin only
router.get("/users", protect, admin, getAllUsers);
router.delete("/delete/:id", protect, admin, deleteUser);

export default router;
    