import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityBlockDto, CreateAvailabilityRuleDto } from './dto/availability.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('slots')
  slots(@Query('from') from: string, @Query('to') to: string) {
    return this.availabilityService.listSlots(from, to);
  }

  @Get('rules')
  @Roles('admin')
  rules() {
    return this.availabilityService.listRules();
  }

  @Post('rules')
  @Roles('admin')
  createRule(@Body() dto: CreateAvailabilityRuleDto) {
    return this.availabilityService.createRule(dto);
  }

  @Patch('rules/:id')
  @Roles('admin')
  updateRule(@Param('id') id: string, @Body() dto: CreateAvailabilityRuleDto) {
    return this.availabilityService.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @Roles('admin')
  deleteRule(@Param('id') id: string) {
    return this.availabilityService.deleteRule(id);
  }

  @Post('blocks')
  @Roles('admin')
  createBlock(@Body() dto: CreateAvailabilityBlockDto) {
    return this.availabilityService.createBlock(dto);
  }

  @Delete('blocks/:id')
  @Roles('admin')
  deleteBlock(@Param('id') id: string) {
    return this.availabilityService.deleteBlock(id);
  }
}
