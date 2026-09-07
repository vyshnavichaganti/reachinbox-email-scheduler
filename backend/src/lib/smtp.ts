import {
  sendEmail,
  getMailTransporter,
  resetMailTransporterForTests,
  type SendEmailInput,
  type SendEmailResult,
} from '../integrations/email/smtp.service';

export type SendMailInput = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

export type SendMailResult = SendEmailResult;
export type { SendEmailInput };

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  return sendEmail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    body: input.text,
  });
}

export { sendEmail, getMailTransporter, resetMailTransporterForTests };
