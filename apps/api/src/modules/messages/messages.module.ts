import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { FieldCryptoService } from '../../common/crypto/field-crypto.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { Message, MessageSchema } from './schemas/message.schema';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway, FieldCryptoService],
  exports: [MessagesService],
})
export class MessagesModule {}
