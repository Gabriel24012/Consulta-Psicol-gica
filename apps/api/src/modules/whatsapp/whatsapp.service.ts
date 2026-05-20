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
    if (this.config.get<string>('WHATSAPP_MODE', 'mock') === 'mock') {
      this.logger.log(`WhatsApp mock to ${to}: ${body}`);
      return { mode: 'mock', to, body };
    }

    const phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const response = await firstValueFrom(
      this.http.post(
        url,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { preview_url: false, body },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return response.data;
  }
}
