import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser } from '@itzel/shared';
import { FieldCryptoService } from '../../common/crypto/field-crypto.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { Message } from './schemas/message.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly crypto: FieldCryptoService,
  ) {}

  async list(patientId: string, user: AuthUser) {
    this.assertCanAccess(patientId, user);
    const messages = await this.messageModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return messages.map((message) => ({
      ...message,
      _id: message._id.toString(),
      patientId: message.patientId.toString(),
      senderId: message.senderId.toString(),
      receiverId: message.receiverId.toString(),
      content: this.safeDecrypt(message.contentEncrypted),
      contentEncrypted: undefined,
    }));
  }

  async send(input: { patientId: string; content: string }, sender: AuthUser) {
    this.assertCanAccess(input.patientId, sender);
    const admin = await this.usersService.findAdmin();
    const receiverId = sender.role === 'admin' ? input.patientId : admin._id.toString();
    const message = await this.messageModel.create({
      patientId: new Types.ObjectId(input.patientId),
      senderId: new Types.ObjectId(sender.sub),
      receiverId: new Types.ObjectId(receiverId),
      contentEncrypted: this.crypto.encrypt(input.content),
    });
    await this.notificationsService.create({
      userId: receiverId,
      type: 'message',
      message: `Nuevo mensaje privado de ${sender.name}.`,
      metadata: { patientId: input.patientId },
    });
    return {
      ...message.toObject(),
      _id: message._id.toString(),
      patientId: message.patientId.toString(),
      senderId: message.senderId.toString(),
      receiverId: message.receiverId.toString(),
      content: input.content,
      contentEncrypted: undefined,
    };
  }

  async conversations(user: AuthUser) {
    if (user.role === 'patient') {
      return [{ patientId: user.sub, title: 'Conversación con tu psicólogo' }];
    }
    const rows = await this.messageModel.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$patientId', lastMessageAt: { $first: '$createdAt' }, unread: { $sum: { $cond: ['$readAt', 0, 1] } } } },
      { $sort: { lastMessageAt: -1 } },
    ]);
    return rows.map((row) => ({ patientId: row._id, lastMessageAt: row.lastMessageAt, unread: row.unread }));
  }

  private assertCanAccess(patientId: string, user: AuthUser) {
    if (user.role === 'patient' && user.sub !== patientId) {
      throw new ForbiddenException('No puedes acceder a una conversación ajena.');
    }
  }

  private safeDecrypt(value: string) {
    try {
      return this.crypto.decrypt(value);
    } catch {
      return '[Mensaje no disponible: fue cifrado con una llave anterior]';
    }
  }
}
