import { Router } from 'express';
import { emailController } from './email.controller';
import { optionalAuth } from '../auth/auth.middleware';

export const emailRouter = Router();

emailRouter.use((req, res, next) => {
  void optionalAuth(req, res, next);
});

emailRouter.post('/schedule', (req, res, next) => {
  void emailController.schedule(req, res, next);
});

emailRouter.post('/bulk-schedule', (req, res, next) => {
  void emailController.bulkSchedule(req, res, next);
});

emailRouter.get('/scheduled', (req, res, next) => {
  void emailController.listScheduled(req, res, next);
});

emailRouter.get('/sent', (req, res, next) => {
  void emailController.listSent(req, res, next);
});

emailRouter.get('/search', (req, res, next) => {
  void emailController.search(req, res, next);
});

emailRouter.get('/:id', (req, res, next) => {
  void emailController.getById(req, res, next);
});

emailRouter.delete('/:id', (req, res, next) => {
  void emailController.cancel(req, res, next);
});
