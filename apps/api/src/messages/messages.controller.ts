import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { MessagesService } from './messages.service';
import { MessageDto } from './dto';

@Controller()
@UseGuards(SessionGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  // Private threads
  @Get('editions/:id/thread/recipient')
  threadRecipient(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.messages.getThreadAsRecipient(id, user);
  }

  @Get('editions/:id/thread/giver')
  threadGiver(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.messages.getThreadAsGiver(id, user);
  }

  @Post('editions/:id/thread/recipient')
  @HttpCode(200)
  postRecipient(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: MessageDto) {
    return this.messages.postAsRecipient(id, user, dto.body);
  }

  @Post('editions/:id/thread/giver')
  @HttpCode(200)
  postGiver(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: MessageDto) {
    return this.messages.postAsGiver(id, user, dto.body);
  }

  // Group chat
  @Get('editions/:id/chat')
  chat(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.messages.getChat(id, user);
  }

  @Post('editions/:id/chat')
  @HttpCode(200)
  postChat(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: MessageDto) {
    return this.messages.postChat(id, user, dto.body);
  }

  @Delete('chat-messages/:messageId')
  deleteChat(@CurrentUser() user: SessionUser, @Param('messageId') messageId: string) {
    return this.messages.deleteChatMessage(messageId, user);
  }
}
