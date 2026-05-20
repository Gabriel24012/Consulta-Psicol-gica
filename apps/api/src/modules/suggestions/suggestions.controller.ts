import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '@itzel/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSuggestionDto, RespondSuggestionDto, UpdateSuggestionStatusDto } from './dto/suggestion.dto';
import { SuggestionsService } from './suggestions.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Post()
  @Roles('patient')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSuggestionDto) {
    return this.suggestionsService.create(user, dto.message);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.suggestionsService.list(user);
  }

  @Patch(':id/status')
  @Roles('admin')
  status(@Param('id') id: string, @Body() dto: UpdateSuggestionStatusDto) {
    return this.suggestionsService.updateStatus(id, dto.status);
  }

  @Post(':id/response')
  @Roles('admin')
  respond(@Param('id') id: string, @Body() dto: RespondSuggestionDto) {
    return this.suggestionsService.respond(id, dto.adminResponse, dto.status);
  }
}
