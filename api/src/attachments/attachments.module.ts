import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from '../entities/attachment.entity';
import { AttachmentsController } from './attachments.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  controllers: [AttachmentsController],
  providers: [StorageService],
})
export class AttachmentsModule {}
