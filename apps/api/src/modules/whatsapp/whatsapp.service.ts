import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async sendText(to: string, body: string) {
    const recipient = this.formatRecipient(to);
    if (this.config.get<string>('WHATSAPP_MODE', 'mock') === 'mock') {
      this.logger.log(`WhatsApp mock to ${recipient}: ${body}`);
      return { mode: 'mock', to: recipient, body };
    }

    const phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
    const graphVersion = this.config.get<string>('WHATSAPP_GRAPH_API_VERSION', 'v25.0');
    const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
    const response = await firstValueFrom(
      this.http.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { preview_url: false, body },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return response.data;
  }

  async sendAppointmentReminder(
    to: string,
    input: { patientName: string; psychologistName: string; date: string; time: string; location: string; previewBody: string },
  ) {
    const recipient = this.formatRecipient(to);
    if (this.config.get<string>('WHATSAPP_MODE', 'mock') === 'mock') {
      this.logger.log(`WhatsApp reminder mock to ${recipient}: ${input.previewBody}`);
      return { mode: 'mock', to: recipient, body: input.previewBody };
    }

    const templateName = this.config.get<string>('WHATSAPP_APPOINTMENT_REMINDER_TEMPLATE', 'appointment_reminder');
    const languageCode = this.config.get<string>('WHATSAPP_TEMPLATE_LANGUAGE', 'es_MX');
    const phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
    const graphVersion = this.config.get<string>('WHATSAPP_GRAPH_API_VERSION', 'v25.0');
    const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
    const response = await firstValueFrom(
      this.http.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: input.patientName },
                  { type: 'text', text: input.psychologistName },
                  { type: 'text', text: input.date },
                  { type: 'text', text: input.time },
                  { type: 'text', text: input.location },
                ],
              },
            ],
          },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return response.data;
  }

  private formatRecipient(to: string) {
    return to.replace(/[^\d]/g, '');
  }
}
