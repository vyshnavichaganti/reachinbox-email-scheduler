import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { emailService } from './email.service';
import {
  bulkScheduleEmailSchema,
  emailIdParamSchema,
  paginationSchema,
  scheduleEmailSchema,
  searchEmailsSchema,
} from './email.validation';
import { AppError } from '../../lib/errors';

function parseOrThrow<T>(schema: ZodTypeAny, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError('Validation failed', 400, result.error.flatten());
  }
  return result.data as T;
}

export class EmailController {
  async schedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = parseOrThrow<ReturnType<typeof scheduleEmailSchema.parse>>(
        scheduleEmailSchema,
        req.body,
      );
      if (req.user && body.userId !== req.user.id) {
        throw new AppError('Forbidden — Cannot schedule emails for another user', 403);
      }
      const email = await emailService.scheduleEmail(body);
      res.status(201).json({
        success: true,
        data: email,
      });
    } catch (err) {
      next(err);
    }
  }

  async bulkSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = parseOrThrow<ReturnType<typeof bulkScheduleEmailSchema.parse>>(
        bulkScheduleEmailSchema,
        req.body,
      );
      if (req.user && body.userId !== req.user.id) {
        throw new AppError('Forbidden — Cannot schedule emails for another user', 403);
      }
      const result = await emailService.bulkScheduleEmails(body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listScheduled(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseOrThrow<ReturnType<typeof paginationSchema.parse>>(
        paginationSchema,
        req.query,
      );
      const result = await emailService.listScheduled(query, req.user?.id);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async listSent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseOrThrow<ReturnType<typeof paginationSchema.parse>>(
        paginationSchema,
        req.query,
      );
      const result = await emailService.listSent(query, req.user?.id);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseOrThrow<ReturnType<typeof searchEmailsSchema.parse>>(
        searchEmailsSchema,
        req.query,
      );
      const result = await emailService.searchEmails(query, req.user?.id);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = parseOrThrow<{ id: string }>(emailIdParamSchema, req.params);
      const email = await emailService.getById(id, req.user?.id);
      res.status(200).json({
        success: true,
        data: email,
      });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = parseOrThrow<{ id: string }>(emailIdParamSchema, req.params);
      const email = await emailService.cancelEmail(id, req.user?.id);
      res.status(200).json({
        success: true,
        data: email,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const emailController = new EmailController();
