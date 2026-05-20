import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientProfile, PatientProfileSchema } from '../patients/schemas/patient-profile.schema';
import { UsersModule } from '../users/users.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([{ name: PatientProfile.name, schema: PatientProfileSchema }]),
  ],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
