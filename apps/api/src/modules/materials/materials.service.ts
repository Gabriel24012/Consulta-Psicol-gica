import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { Model, Types } from 'mongoose';
import { AuthUser } from '@itzel/shared';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/schemas/user.schema';
import { CreateMaterialSectionDto, UpdateMaterialSectionDto } from './dto/materials.dto';
import { MaterialFile } from './schemas/material-file.schema';
import { MaterialRelease } from './schemas/material-release.schema';
import { MaterialSection } from './schemas/material-section.schema';

export const MATERIAL_FILE_LIMIT_BYTES = 20 * 1024 * 1024;
export const MATERIAL_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export interface UploadedMaterialFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class MaterialsService implements OnModuleInit {
  private readonly uploadDir: string;

  constructor(
    @InjectModel(MaterialSection.name) private readonly sectionModel: Model<MaterialSection>,
    @InjectModel(MaterialFile.name) private readonly fileModel: Model<MaterialFile>,
    @InjectModel(MaterialRelease.name) private readonly releaseModel: Model<MaterialRelease>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
  ) {
    this.uploadDir = this.config.get<string>('MATERIALS_UPLOAD_DIR') ?? join(process.cwd(), 'uploads', 'materials');
  }

  async onModuleInit() {
    await mkdir(this.uploadDir, { recursive: true });
  }

  async listSectionsForAdmin() {
    const sections = await this.sectionModel.find().sort({ createdAt: -1 }).lean().exec();
    const sectionIds = sections.map((section) => section._id);
    const [files, releases] = await Promise.all([
      this.fileModel.find({ sectionId: { $in: sectionIds } }).sort({ createdAt: -1 }).lean().exec(),
      this.releaseModel
        .find({ sectionId: { $in: sectionIds } })
        .populate('patientId', 'name email phone')
        .lean()
        .exec(),
    ]);

    return sections.map((section) => ({
      ...section,
      files: files
        .filter((file) => file.sectionId.toString() === section._id.toString())
        .map((file) => this.publicFile(file)),
      releasedPatients: releases
        .filter((release) => release.sectionId.toString() === section._id.toString())
        .map((release) => release.patientId),
      releasedCount: releases.filter((release) => release.sectionId.toString() === section._id.toString()).length,
      fileCount: files.filter((file) => file.sectionId.toString() === section._id.toString()).length,
    }));
  }

  async createSection(input: CreateMaterialSectionDto, actor: AuthUser) {
    const section = await this.sectionModel.create({
      title: input.title.trim(),
      description: input.description?.trim(),
      createdBy: new Types.ObjectId(actor.sub),
    });
    await this.auditLog.record({
      actorId: actor.sub,
      action: 'material_section.created',
      entityType: 'MaterialSection',
      entityId: section._id.toString(),
      metadata: { title: section.title },
    });
    return section;
  }

  async updateSection(sectionId: string, input: UpdateMaterialSectionDto, actor: AuthUser) {
    const section = await this.sectionModel
      .findByIdAndUpdate(
        this.toObjectId(sectionId),
        {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        { new: true },
      )
      .exec();
    if (!section) {
      throw new NotFoundException('Sección no encontrada.');
    }
    await this.auditLog.record({
      actorId: actor.sub,
      action: 'material_section.updated',
      entityType: 'MaterialSection',
      entityId: section._id.toString(),
      metadata: { ...input },
    });
    return section;
  }

  async deactivateSection(sectionId: string, actor: AuthUser) {
    return this.updateSection(sectionId, { isActive: false }, actor);
  }

  async addFiles(sectionId: string, uploadedFiles: UploadedMaterialFile[], actor: AuthUser) {
    const section = await this.sectionModel.findById(this.toObjectId(sectionId)).exec();
    if (!section) {
      throw new NotFoundException('Sección no encontrada.');
    }
    if (!uploadedFiles.length) {
      throw new BadRequestException('Selecciona al menos un archivo.');
    }
    uploadedFiles.forEach((file) => this.validateFile(file));

    const savedFiles = [];
    for (const file of uploadedFiles) {
      const extension = this.extensionFor(file);
      const storedName = `${randomUUID()}${extension}`;
      const filePath = join(this.uploadDir, storedName);
      await writeFile(filePath, file.buffer);
      const savedFile = await this.fileModel.create({
        sectionId: section._id,
        originalName: file.originalname,
        storedName,
        mimeType: file.mimetype,
        size: file.size,
        path: filePath,
      });
      savedFiles.push(savedFile);
    }

    await this.auditLog.record({
      actorId: actor.sub,
      action: 'material_file.uploaded',
      entityType: 'MaterialSection',
      entityId: section._id.toString(),
      metadata: { count: savedFiles.length },
    });
    return savedFiles;
  }

  async deleteFile(fileId: string, actor: AuthUser) {
    const file = await this.fileModel.findByIdAndDelete(this.toObjectId(fileId)).exec();
    if (!file) {
      throw new NotFoundException('Archivo no encontrado.');
    }
    await unlink(file.path).catch(() => undefined);
    await this.auditLog.record({
      actorId: actor.sub,
      action: 'material_file.deleted',
      entityType: 'MaterialFile',
      entityId: file._id.toString(),
      metadata: { sectionId: file.sectionId.toString(), originalName: file.originalName },
    });
    return { ok: true };
  }

  async releaseSection(sectionId: string, patientIds: string[], actor: AuthUser) {
    const section = await this.sectionModel.findById(this.toObjectId(sectionId)).lean().exec();
    if (!section) {
      throw new NotFoundException('Sección no encontrada.');
    }
    const patientObjectIds = patientIds.map((id) => this.toObjectId(id));
    const patients = await this.userModel
      .find({ _id: { $in: patientObjectIds }, role: 'patient' })
      .select('_id name')
      .lean()
      .exec();
    if (patients.length !== patientIds.length) {
      throw new BadRequestException('Uno o más pacientes no existen.');
    }

    let createdCount = 0;
    for (const patient of patients) {
      const result = await this.releaseModel.updateOne(
        { sectionId: section._id, patientId: patient._id },
        {
          $setOnInsert: {
            sectionId: section._id,
            patientId: patient._id,
            releasedBy: new Types.ObjectId(actor.sub),
            releasedAt: new Date(),
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount) {
        createdCount += 1;
        await this.notifications.create({
          userId: patient._id.toString(),
          type: 'system',
          message: `Tienes nuevo material disponible: ${section.title}.`,
          metadata: { sectionId: section._id.toString() },
        });
      }
    }

    await this.auditLog.record({
      actorId: actor.sub,
      action: 'material_section.released',
      entityType: 'MaterialSection',
      entityId: section._id.toString(),
      metadata: { patientIds, createdCount },
    });
    return { ok: true, releasedCount: createdCount };
  }

  async revokeSection(sectionId: string, patientIds: string[], actor: AuthUser) {
    const sectionObjectId = this.toObjectId(sectionId);
    const patientObjectIds = patientIds.map((id) => this.toObjectId(id));
    const result = await this.releaseModel
      .deleteMany({ sectionId: sectionObjectId, patientId: { $in: patientObjectIds } })
      .exec();
    await this.auditLog.record({
      actorId: actor.sub,
      action: 'material_section.revoked',
      entityType: 'MaterialSection',
      entityId: sectionId,
      metadata: { patientIds, deletedCount: result.deletedCount },
    });
    return { ok: true, revokedCount: result.deletedCount };
  }

  async listForPatient(user: AuthUser) {
    const patientId = this.toObjectId(user.sub);
    const releases = await this.releaseModel.find({ patientId }).lean().exec();
    const sectionIds = releases.map((release) => release.sectionId);
    const sections = await this.sectionModel
      .find({ _id: { $in: sectionIds }, isActive: true })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const files = await this.fileModel
      .find({ sectionId: { $in: sections.map((section) => section._id) } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return sections.map((section) => ({
      ...section,
      files: files
        .filter((file) => file.sectionId.toString() === section._id.toString())
        .map((file) => this.publicFile(file)),
    }));
  }

  async getDownload(fileId: string, viewer: AuthUser) {
    const file = await this.fileModel.findById(this.toObjectId(fileId)).lean().exec();
    if (!file) {
      throw new NotFoundException('Archivo no encontrado.');
    }
    const section = await this.sectionModel.findById(file.sectionId).lean().exec();
    if (!section || !section.isActive) {
      throw new NotFoundException('Archivo no encontrado.');
    }
    if (viewer.role === 'patient') {
      const release = await this.releaseModel
        .exists({ sectionId: file.sectionId, patientId: new Types.ObjectId(viewer.sub) })
        .exec();
      if (!release) {
        throw new ForbiddenException('No tienes acceso a este material.');
      }
    }
    return file;
  }

  private validateFile(file: UploadedMaterialFile) {
    if (!MATERIAL_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Solo se permiten archivos PDF, DOC o DOCX.');
    }
    if (file.size > MATERIAL_FILE_LIMIT_BYTES) {
      throw new BadRequestException('El archivo no puede superar 20 MB.');
    }
  }

  private extensionFor(file: UploadedMaterialFile) {
    const fromName = extname(file.originalname).toLowerCase();
    if (fromName && ['.pdf', '.doc', '.docx'].includes(fromName)) {
      return fromName;
    }
    const byMime: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    };
    return byMime[file.mimetype] ?? '';
  }

  private toObjectId(value: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Identificador inválido.');
    }
    return new Types.ObjectId(value);
  }

  private publicFile(file: {
    _id: unknown;
    sectionId: unknown;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      _id: file._id,
      sectionId: file.sectionId,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}
