import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsModule } from '../appointments/appointments.module';
import { UsersModule } from '../users/users.module';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { AvailabilityBlock, AvailabilityBlockSchema } from './schemas/availability-block.schema';
import { AvailabilityRule, AvailabilityRuleSchema } from './schemas/availability-rule.schema';

@Module({
  imports: [
    UsersModule,
    forwardRef(() => AppointmentsModule),
    MongooseModule.forFeature([
      { name: AvailabilityRule.name, schema: AvailabilityRuleSchema },
      { name: AvailabilityBlock.name, schema: AvailabilityBlockSchema },
    ]),
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService, MongooseModule],
})
export class AvailabilityModule {}
