import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { CrmModule } from './modules/crm/crm.module';
import { MessagesModule } from './modules/messages/messages.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PatientInvitationsModule } from './modules/patient-invitations/patient-invitations.module';
import { SuggestionsModule } from './modules/suggestions/suggestions.module';
import { UsersModule } from './modules/users/users.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string>('REDIS_PORT') ?? 6379),
          ...(config.get<string>('REDIS_PASSWORD') ? { password: config.get<string>('REDIS_PASSWORD') } : {}),
        },
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: 120,
            getTracker: (request) => request.ip,
          },
          {
            name: 'auth',
            ttl: Number(config.get<string>('AUTH_RATE_LIMIT_TTL') ?? 60_000),
            limit: Number(config.get<string>('AUTH_RATE_LIMIT_LIMIT') ?? 10),
            getTracker: (request) => request.ip,
          },
        ],
      }),
    }),
    AuditLogModule,
    UsersModule,
    PatientsModule,
    PatientInvitationsModule,
    AuthModule,
    AvailabilityModule,
    AppointmentsModule,
    MaterialsModule,
    NotificationsModule,
    MessagesModule,
    SuggestionsModule,
    WhatsappModule,
    CrmModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
