import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';

@Injectable()
export class AuditLogService {
  constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLog>) {}

  record(input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.auditModel.create({
      ...input,
      actorId: new Types.ObjectId(input.actorId),
      entityId: input.entityId ? new Types.ObjectId(input.entityId) : undefined,
    });
  }
}
