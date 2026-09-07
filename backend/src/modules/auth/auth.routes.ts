import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from './auth.middleware';

export const authRouter = Router();

authRouter.get('/google', (req, res, next) => {
  authController.googleAuth(req, res, next);
});

authRouter.get('/google/callback', (req, res, next) => {
  void authController.googleCallback(req, res, next);
});

authRouter.get('/me', requireAuth, (req, res) => {
  authController.me(req, res);
});

authRouter.post('/logout', (req, res) => {
  authController.logout(req, res);
});
