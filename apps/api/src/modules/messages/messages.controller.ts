import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '@itzel/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/message.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations/me')
  conversations(@CurrentUser() user: AuthUser) {
    return this.messagesService.conversations(user);
  }

  @Get('conversations/patient/:patientId')
  patientConversation(@Param('patientId') patientId: string, @CurrentUser() user: AuthUser) {
    return this.messagesService.list(patientId, user);
  }

  @Get('messages/:patientId')
  list(@Param('patientId') patientId: string, @CurrentUser() user: AuthUser) {
    return this.messagesService.list(patientId, user);
  }

  @Post('messages')
  send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthUser) {
    return this.messagesService.send(dto, user);
  }
}
