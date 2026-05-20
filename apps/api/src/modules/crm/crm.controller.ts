import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CrmService } from './crm.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('summary')
  summary() {
    return this.crmService.summary();
  }

  @Get('inactive-patients')
  inactive(@Query('days') days?: string) {
    return this.crmService.inactivePatients(days ? Number(days) : 30);
  }

  @Post('patients/:id/follow-up')
  followUp(@Param('id') id: string) {
    return this.crmService.followUp(id);
  }

  @Post('patients/:id/reminder')
  reminder(@Param('id') id: string) {
    return this.crmService.sendReminder(id);
  }
}
