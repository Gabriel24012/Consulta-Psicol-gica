import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser, NotificationType } from '@itzel/shared';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Notification } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    private readonly whatsappService: WhatsappService,
  ) {}

  create(input: { userId: string; type: NotificationType; message: string; metadata?: Record<string, unknown> }) {
    return this.notificationModel.create({
      ...input,
      userId: new Types.ObjectId(input.userId),
    });
  }

  listForUser(user: AuthUser) {
    return this.notificationModel.find({ userId: user.sub }).sort({ createdAt: -1 }).limit(100).exec();
  }

  markRead(id: string, user: AuthUser) {
    return this.notificationModel
      .findOneAndUpdate({ _id: id, userId: user.sub }, { readAt: new Date() }, { new: true })
      .exec();
  }

  testWhatsapp(to: string) {
    return this.whatsappService.sendText(
      to,
      'Mensaje de prueba del portal: las notificaciones administrativas están configuradas.',
    );
  }
}
