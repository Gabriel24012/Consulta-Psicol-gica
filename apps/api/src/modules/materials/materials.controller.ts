import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMaterialSectionDto, MaterialPatientsDto, UpdateMaterialSectionDto } from './dto/materials.dto';
import {
  MATERIAL_FILE_LIMIT_BYTES,
  MaterialsService,
  UploadedMaterialFile,
} from './materials.service';
import { AuthUser } from '@itzel/shared';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('sections')
  @Roles('admin')
  listSections() {
    return this.materialsService.listSectionsForAdmin();
  }

  @Post('sections')
  @Roles('admin')
  createSection(@Body() dto: CreateMaterialSectionDto, @CurrentUser() user: AuthUser) {
    return this.materialsService.createSection(dto, user);
  }

  @Patch('sections/:id')
  @Roles('admin')
  updateSection(@Param('id') id: string, @Body() dto: UpdateMaterialSectionDto, @CurrentUser() user: AuthUser) {
    return this.materialsService.updateSection(id, dto, user);
  }

  @Delete('sections/:id')
  @Roles('admin')
  deactivateSection(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.materialsService.deactivateSection(id, user);
  }

  @Post('sections/:id/files')
  @Roles('admin')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MATERIAL_FILE_LIMIT_BYTES },
    }),
  )
  addFiles(
    @Param('id') id: string,
    @UploadedFiles() files: UploadedMaterialFile[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.materialsService.addFiles(id, files ?? [], user);
  }

  @Delete('files/:fileId')
  @Roles('admin')
  deleteFile(@Param('fileId') fileId: string, @CurrentUser() user: AuthUser) {
    return this.materialsService.deleteFile(fileId, user);
  }

  @Post('sections/:id/release')
  @Roles('admin')
  releaseSection(@Param('id') id: string, @Body() dto: MaterialPatientsDto, @CurrentUser() user: AuthUser) {
    return this.materialsService.releaseSection(id, dto.patientIds, user);
  }

  @Post('sections/:id/revoke')
  @Roles('admin')
  revokeSection(@Param('id') id: string, @Body() dto: MaterialPatientsDto, @CurrentUser() user: AuthUser) {
    return this.materialsService.revokeSection(id, dto.patientIds, user);
  }

  @Get('me')
  @Roles('patient')
  listMine(@CurrentUser() user: AuthUser) {
    return this.materialsService.listForPatient(user);
  }

  @Get('files/:fileId/download')
  async download(@Param('fileId') fileId: string, @CurrentUser() user: AuthUser, @Res() response: Response) {
    const file = await this.materialsService.getDownload(fileId, user);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.attachment(file.originalName);
    createReadStream(file.path).pipe(response);
  }
}
