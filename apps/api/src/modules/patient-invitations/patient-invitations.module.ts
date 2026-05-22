import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuthModule } from '../auth/auth.module';
import { PatientsModule } from '../patients/patients.module';
import { UsersModule } from '../users/users.module';
import { PatientInvitationsController } from './patient-invitations.controller';
import { PatientInvitationsService } from './patient-invitations.service';
import { PatientInvitation, PatientInvitationSchema } from './schemas/patient-invitation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PatientInvitation.name, schema: PatientInvitationSchema }]),
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    AuthModule,
  ],
  controllers: [PatientInvitationsController],
  providers: [PatientInvitationsService],
})
export class PatientInvitationsModule {}
