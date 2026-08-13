import { BadGatewayException, Injectable } from '@nestjs/common';

export interface ResendEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class ResendService {
  async sendEmail(email: ResendEmail) {
    const response = await fetch(this.getRequiredEnvironment('RESEND_API_URL'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getRequiredEnvironment('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.getRequiredEnvironment('RESEND_FROM_EMAIL'),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException('Email gagal dikirim.');
    }
  }

  private getRequiredEnvironment(name: string) {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} wajib diisi.`);
    }

    return value;
  }
}
