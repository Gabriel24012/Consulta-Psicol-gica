import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AvailabilityModule } from '../availability/availability.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';
import { UsersModule } from '../users/users.module';
import { Appointment, AppointmentSchema } from './schemas/appointment.schema';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsProcessor } from './appointments.processor';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'appointments' }),
    MongooseModule.forFeature([{ name: Appointment.name, schema: AppointmentSchema }]),
    UsersModule,
    PatientsModule,
    NotificationsModule,
    forwardRef(() => AvailabilityModule),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsProcessor],
  exports: [AppointmentsService, MongooseModule],
})
export class AppointmentsModule {}
