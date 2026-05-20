import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FieldCryptoService } from '../../common/crypto/field-crypto.service';
import { UsersModule } from '../users/users.module';
import { PatientProfile, PatientProfileSchema } from './schemas/patient-profile.schema';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: PatientProfile.name, schema: PatientProfileSchema }]),
  ],
  controllers: [PatientsController],
  providers: [PatientsService, FieldCryptoService],
  exports: [PatientsService, MongooseModule],
})
export class PatientsModule {}
