import express from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { authSchemas } from '../middlewares/validation.js';

const router = express.Router();
const authController = new AuthController();

router.post(
  '/register',
  authSchemas.register,     // ✅ pass array directly
  authController.register
);

router.post(
  '/login',
  authSchemas.login,        // ✅
  authController.login
);

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL}/auth/error`,
    session: false,
  }),
  authController.googleCallback
);

router.post(
  '/refresh',
  authSchemas.refreshToken, // ✅
  authController.refresh
);

router.post(
  '/logout',
  authMiddleware.protect,
  authController.logout
);

router.get(
  '/profile',
  authMiddleware.protect,
  authController.getProfile
);

router.put(
  '/profile',
  authMiddleware.protect,
  authSchemas.updateProfile, // ✅
  authController.updateProfile
);

router.get(
  '/test-protected',
  authMiddleware.protect,
  (req, res) => {
    res.json({
      message: 'Access granted to protected route',
      user: req.user.email,
    });
  }
);

export default router;
