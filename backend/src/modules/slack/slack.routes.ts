import { Router } from 'express';
import { slackController } from './slack.controller';
import { requireAuth } from '../auth/auth.middleware';

export const slackRouter = Router();

slackRouter.get('/connect', requireAuth, (req, res, next) => {
  slackController.connect(req, res, next);
});

slackRouter.get('/callback', requireAuth, (req, res, next) => {
  void slackController.callback(req, res, next);
});

slackRouter.get('/status', requireAuth, (req, res, next) => {
  void slackController.getStatus(req, res, next);
});

slackRouter.delete('/disconnect', requireAuth, (req, res, next) => {
  void slackController.disconnect(req, res, next);
});
