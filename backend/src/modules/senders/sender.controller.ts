import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

export class SenderController {
  async listSenders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      let senders = await prisma.sender.findMany({
        where: userId ? { userId } : {},
        orderBy: { createdAt: 'desc' },
      });

      // If user has no senders yet, provision a default sender identity for this user
      if (senders.length === 0 && req.user) {
        const defaultSender = await prisma.sender.upsert({
          where: {
            userId_email: {
              userId: req.user.id,
              email: req.user.email,
            },
          },
          update: {
            displayName: req.user.name || req.user.email.split('@')[0],
          },
          create: {
            userId: req.user.id,
            email: req.user.email,
            displayName: req.user.name || req.user.email.split('@')[0],
          },
        });
        senders = [defaultSender];
      }

      res.status(200).json({
        success: true,
        data: senders,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const senderController = new SenderController();
