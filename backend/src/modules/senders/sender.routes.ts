import { Router } from 'express';
import { senderController } from './sender.controller';
import { optionalAuth } from '../auth/auth.middleware';

export const senderRouter = Router();

senderRouter.use((req, res, next) => {
  void optionalAuth(req, res, next);
});

senderRouter.get('/', (req, res, next) => {
  void senderController.listSenders(req, res, next);
});
