import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export type SendEmailInput = {
  from?: string;
  to: string;
  subject: string;
  body: string;
};

export type SendEmailResult = {
  messageId: string;
  previewUrl: string | false;
  accepted: string[];
  rejected: string[];
};

let transporterPromise: Promise<Transporter> | null = null;

async function createTransporter(): Promise<Transporter> {
  let user = env.SMTP_USER;
  let pass = env.SMTP_PASSWORD || env.SMTP_PASS;
  let host = env.SMTP_HOST;
  let port = env.SMTP_PORT;

  if (!user || !pass) {
    if (env.NODE_ENV === 'production') {
      throw new Error('SMTP_USER and SMTP_PASSWORD (or SMTP_PASS) are required in production');
    }

    const testAccount = await nodemailer.createTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
    host = testAccount.smtp.host;
    port = testAccount.smtp.port;
    logger.info('Created Ethereal test account for SMTP', {
      user,
      smtp: testAccount.smtp,
    });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.verify();
  logger.info('SMTP transporter ready', { host, port });
  return transporter;
}

export async function getMailTransporter(): Promise<Transporter> {
  if (!transporterPromise) {
    transporterPromise = createTransporter().catch((err) => {
      transporterPromise = null;
      throw err;
    });
  }
  return transporterPromise;
}

/**
 * Sends an email using Nodemailer and Ethereal SMTP integration.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const transporter = await getMailTransporter();
  const senderAddress = input.from || env.SMTP_FROM;

  const info = await transporter.sendMail({
    from: senderAddress,
    to: input.to,
    subject: input.subject,
    text: input.body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  logger.info('SMTP email sent successfully', {
    messageId: info.messageId,
    to: input.to,
    previewUrl: previewUrl || undefined,
  });

  return {
    messageId: info.messageId,
    previewUrl,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
  };
}

export function resetMailTransporterForTests(): void {
  transporterPromise = null;
}
