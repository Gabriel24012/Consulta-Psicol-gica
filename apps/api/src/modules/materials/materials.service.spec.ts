import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { MaterialsService, UploadedMaterialFile } from './materials.service';

describe('MaterialsService', () => {
  const sectionId = new Types.ObjectId();
  const fileId = new Types.ObjectId();
  const patientId = new Types.ObjectId();

  function createService(overrides: Record<string, unknown> = {}) {
    const sectionModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: sectionId, isActive: true }),
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: sectionId, isActive: true }) }),
      }),
      ...((overrides.sectionModel as object) ?? {}),
    };
    const fileModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: fileId,
            sectionId,
            originalName: 'guia.pdf',
            mimeType: 'application/pdf',
            size: 1200,
            path: 'guia.pdf',
          }),
        }),
      }),
      ...((overrides.fileModel as object) ?? {}),
    };
    const releaseModel = {
      exists: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      ...((overrides.releaseModel as object) ?? {}),
    };

    return new MaterialsService(
      sectionModel as any,
      fileModel as any,
      releaseModel as any,
      {} as any,
      { get: jest.fn().mockReturnValue('C:/tmp/materials-test') } as any,
      { create: jest.fn() } as any,
      { record: jest.fn() } as any,
    );
  }

  it('rejects unsupported file types before saving', async () => {
    const service = createService();
    const file: UploadedMaterialFile = {
      originalname: 'notas.txt',
      mimetype: 'text/plain',
      size: 20,
      buffer: Buffer.from('hola'),
    };

    await expect(service.addFiles(sectionId.toString(), [file], { sub: patientId.toString(), role: 'admin', name: 'Itzel', email: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blocks patient downloads without a release', async () => {
    const service = createService();

    await expect(
      service.getDownload(fileId.toString(), {
        sub: patientId.toString(),
        role: 'patient',
        name: 'Paciente',
        email: '',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
