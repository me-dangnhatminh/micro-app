import { Authenticated, HttpUser } from '@app/auth-client';
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Logger,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('storage')
@ApiBearerAuth()
@Controller({ path: 'storage', version: '1' })
@UseGuards(Authenticated)
export class StorageRestController {
  private readonly logger = new Logger(StorageRestController.name);

  constructor(
    @Inject('StorageService') private readonly storageService,
    @Inject('UserService') private readonly userService,
  ) {}

  @Get('my-storage')
  async my(@HttpUser() user, @Res({ passthrough: true }) res) {
    const storageId = user?.metadata['my-storage'];
    // crate if null
    if (!storageId) {
      this.logger.warn('Storage not found, creating new one');
      const storage = await this.storageService.create({ ownerId: user.id });
      await this.userService.update({
        id: user.id,
        metadata: { 'my-storage': storage.id },
      });
      res.status(201);
      return storage;
    }
    const storage = await this.storageService.get({ id: storageId });
    if (!storage) {
      this.logger.error('Storage not found');
      throw new BadRequestException('Storage not found');
    }
    return storage;
  }
}
