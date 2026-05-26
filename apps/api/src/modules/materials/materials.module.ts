import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';
import { MaterialFile, MaterialFileSchema } from './schemas/material-file.schema';
import { MaterialRelease, MaterialReleaseSchema } from './schemas/material-release.schema';
import { MaterialSection, MaterialSectionSchema } from './schemas/material-section.schema';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    NotificationsModule,
    AuditLogModule,
    MongooseModule.forFeature([
      { name: MaterialSection.name, schema: MaterialSectionSchema },
      { name: MaterialFile.name, schema: MaterialFileSchema },
      { name: MaterialRelease.name, schema: MaterialReleaseSchema },
    ]),
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
