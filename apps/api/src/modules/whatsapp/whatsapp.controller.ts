import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly config: ConfigService) {}

  @Get('webhook')
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    if (mode === 'subscribe' && token === this.config.get<string>('WHATSAPP_VERIFY_TOKEN')) {
      return challenge;
    }
    return { ok: false };
  }

  @Post('webhook')
  receive(@Body() payload: unknown) {
    return { ok: true, received: Boolean(payload) };
  }
}
