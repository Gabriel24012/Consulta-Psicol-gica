import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser, SuggestionStatus } from '@itzel/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { Suggestion } from './schemas/suggestion.schema';

@Injectable()
export class SuggestionsService {
  constructor(
    @InjectModel(Suggestion.name) private readonly suggestionModel: Model<Suggestion>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(user: AuthUser, message: string) {
    const suggestion = await this.suggestionModel.create({ patientId: new Types.ObjectId(user.sub), message });
    const admin = await this.usersService.findAdmin();
    await this.notificationsService.create({
      userId: admin._id.toString(),
      type: 'suggestion',
      message: `${user.name} envió una sugerencia o comentario administrativo.`,
      metadata: { suggestionId: suggestion._id },
    });
    return suggestion;
  }

  list(user: AuthUser) {
    const filter = user.role === 'admin' ? {} : { patientId: user.sub };
    return this.suggestionModel.find(filter).sort({ createdAt: -1 }).populate('patientId', 'name email').exec();
  }

  updateStatus(id: string, status: SuggestionStatus) {
    return this.suggestionModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }

  respond(id: string, adminResponse: string, status: SuggestionStatus = 'answered') {
    return this.suggestionModel.findByIdAndUpdate(id, { adminResponse, status }, { new: true }).exec();
  }
}
