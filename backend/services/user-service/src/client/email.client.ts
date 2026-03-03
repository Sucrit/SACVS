import nodemailer from 'nodemailer';
import { ENV } from '../config/env';

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isEnabled = () =>
  Boolean(
    ENV.SMTP_HOST?.trim() &&
    ENV.SMTP_USER?.trim() &&
    ENV.SMTP_PASS?.trim() &&
    ENV.SMTP_FROM?.trim(),
  );

export class EmailClient {
  async sendStepUpOtpEmail(payload: {
    to: string;
    otpCode: string;
    expiresInMinutes: number;
    actionLabel: string;
  }): Promise<void> {
    if (!isEnabled()) {
      throw new Error('STEP_UP_DELIVERY_NOT_CONFIGURED');
    }

    const transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: parsePort(ENV.SMTP_PORT, 587),
      secure: ENV.SMTP_SECURE === 'true',
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: ENV.SMTP_FROM,
      to: payload.to,
      subject: 'Your SACVS security verification code',
      text: [
        'A step-up security verification was requested.',
        `Action: ${payload.actionLabel}`,
        `Code: ${payload.otpCode}`,
        `Expires in: ${payload.expiresInMinutes} minute(s)`,
        '',
        'If you did not request this, ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2 style="margin:0 0 12px">Security verification code</h2>
          <p style="margin:0 0 10px">A step-up verification was requested for <strong>${payload.actionLabel}</strong>.</p>
          <p style="margin:0 0 10px">Use this code:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:0 0 10px">${payload.otpCode}</p>
          <p style="margin:0 0 10px">Expires in ${payload.expiresInMinutes} minute(s).</p>
          <p style="margin:0;color:#475569">If you did not request this, ignore this email.</p>
        </div>
      `,
    });
  }
}

export const emailClient = new EmailClient();
