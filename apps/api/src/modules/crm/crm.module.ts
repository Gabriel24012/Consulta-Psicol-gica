import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { PatientProfile, PatientProfileSchema } from '../patients/schemas/patient-profile.schema';
import { UsersModule } from '../users/users.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    WhatsappModule,
    MongooseModule.forFeature([
      { name: PatientProfile.name, schema: PatientProfileSchema },
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
  ],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
