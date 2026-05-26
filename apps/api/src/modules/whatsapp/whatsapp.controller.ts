import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly config: ConfigService) {}

  @Throttle({ auth: { ttl: 60_000, limit: 30 } })
  @Get('webhook')
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    if (mode === 'subscribe' && token === this.config.get<string>('WHATSAPP_VERIFY_TOKEN')) {
      return challenge;
    }
    return { ok: false };
  }

  @Throttle({ auth: { ttl: 60_000, limit: 60 } })
  @Post('webhook')
  receive(@Body() payload: unknown) {
    return { ok: true, received: Boolean(payload) };
  }
}
