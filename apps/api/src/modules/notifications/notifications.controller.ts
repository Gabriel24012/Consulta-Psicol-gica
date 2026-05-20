import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthUser } from '@itzel/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsService } from './notifications.service';

class TestWhatsappDto {
  @IsString()
  to!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notificationsService.listForUser(user);
  }

  @Patch(':id/read')
  read(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markRead(id, user);
  }

  @Post('test-whatsapp')
  @Roles('admin')
  testWhatsapp(@Body() dto: TestWhatsappDto) {
    return this.notificationsService.testWhatsapp(dto.to);
  }
}
