import { Module } from '@nestjs/common';
import { CompletionsController } from './completions.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [CompletionsController],
  providers: [ChatService],
})
export class ChatModule {}
