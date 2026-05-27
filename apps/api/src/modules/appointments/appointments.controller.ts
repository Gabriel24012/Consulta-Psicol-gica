import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '@itzel/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAdminAppointmentDto, CreateAppointmentDto, RescheduleAppointmentDto, UpdateAppointmentStatusDto } from './dto/appointment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles('patient')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user, dto);
  }

  @Get()
  @Roles('admin')
  list(@CurrentUser() user: AuthUser) {
    return this.appointmentsService.listForUser(user);
  }

  @Get('me')
  @Roles('patient')
  mine(@CurrentUser() user: AuthUser) {
    return this.appointmentsService.listMine(user);
  }

  @Post('admin/patients/:patientId')
  @Roles('admin')
  createForPatient(@Param('patientId') patientId: string, @Body() dto: CreateAdminAppointmentDto) {
    return this.appointmentsService.createForExistingPatientByAdmin(patientId, dto);
  }

  @Patch(':id/status')
  @Roles('admin')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.appointmentsService.updateStatus(id, dto.status);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.appointmentsService.cancel(id, user);
  }

  @Post(':id/reschedule')
  reschedule(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: RescheduleAppointmentDto) {
    return this.appointmentsService.reschedule(id, user, dto);
  }
}
