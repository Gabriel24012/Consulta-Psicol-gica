import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { Suggestion, SuggestionSchema } from './schemas/suggestion.schema';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([{ name: Suggestion.name, schema: SuggestionSchema }]),
  ],
  controllers: [SuggestionsController],
  providers: [SuggestionsService],
})
export class SuggestionsModule {}
