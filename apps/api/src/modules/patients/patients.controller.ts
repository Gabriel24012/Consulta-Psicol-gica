import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePatientNoteDto, UpdatePatientPackageDto, UpdatePatientStatusDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';
import { AuthUser } from '@itzel/shared';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @Roles('admin')
  list(@Query('search') search?: string, @Query('status') status?: string) {
    return this.patientsService.list({ search, status });
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.getPatientForViewer(id, user);
  }

  @Patch(':id/status')
  @Roles('admin')
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePatientStatusDto) {
    return this.patientsService.updateStatus(id, dto.patientStatus);
  }

  @Patch(':id/package')
  @Roles('admin')
  updatePackage(@Param('id') id: string, @Body() dto: UpdatePatientPackageDto) {
    return this.patientsService.updatePackage(id, dto.remainingSessions);
  }

  @Post(':id/notes')
  @Roles('admin')
  updateNotes(@Param('id') id: string, @Body() dto: CreatePatientNoteDto) {
    return this.patientsService.updateNotes(id, dto);
  }
}
