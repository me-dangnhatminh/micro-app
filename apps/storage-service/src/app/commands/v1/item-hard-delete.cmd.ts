import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { ClientProxy } from '@nestjs/microservices';
import Decimal from 'decimal.js';
import { StorageEvent, UUID } from 'src/domain';
import { z } from 'zod';

export const ItemHardDelete = z.object({
  type: z.union([z.literal('file'), z.literal('folder')]),
  id: z.string(),
});
export type ItemHardDelete = z.infer<typeof ItemHardDelete>;

export class HardDeleteItemCmd implements ICommand {
  constructor(
    public readonly rootId: string,
    public readonly item: ItemHardDelete,
  ) {
    try {
      this.rootId = UUID.parse(rootId);
      this.item = ItemHardDelete.parse(item);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `${HardDeleteItemCmd.name}: invalid input ${error.message}`,
        );
      }
      throw error;
    }
  }
}

@CommandHandler(HardDeleteItemCmd)
export class HardDeleteItemHandler
  implements ICommandHandler<HardDeleteItemCmd>
{
  private readonly tx = this.txHost.tx;
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('StorageQueue') private readonly storageQueue: ClientProxy,
  ) {}

  @Transactional()
  async execute(command: HardDeleteItemCmd) {
    const item = command.item;

    switch (item.type) {
      case 'folder':
        await this.deleteFolder(item.id);
        break;
      case 'file':
        await this.deleteFile(command.rootId, item.id);
        break;
      default:
        throw new Error('Unknown item type');
    }
  }

  private async deleteFolder(id: string) {
    const folder = await this.tx.folder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('Folder not found');
    if (!folder.rootId) {
      throw new BadRequestException('Root folder cannot be deleted');
    }
    if (!folder.archivedAt) {
      const msg = 'Direct deletion is not allowed, use archive instead';
      throw new BadRequestException(msg);
    }
    if (folder.ownerId !== folder.ownerId) {
      throw new ForbiddenException('Only owner can delete folder');
    }

    const rootId = folder.rootId;
    const flatFolders = await this.tx.folder.findMany({
      where: {
        rootId: rootId,
        lft: { gte: folder.lft },
        rgt: { lte: folder.rgt },
      },
      include: {
        files: { include: { file: { select: { id: true, size: true } } } },
      },
    });

    const sizeRemoved = flatFolders.reduce((acc, folder) => {
      const size = folder.files.reduce(
        (acc, f) => acc.add(f.file.size.toString()),
        new Decimal(0),
      );
      return acc.add(size);
    }, new Decimal(0));

    // ===================== DELETE =======================
    const tasks: Promise<any>[] = [];

    const fileIds = flatFolders.flatMap((f) => f.files.map((f) => f.file.id));

    const removeFiles = this.tx.fileRef
      .deleteMany({ where: { id: { in: fileIds } } })
      .then((d) => d.count === fileIds.length)
      .then((res) => {
        if (!res) {
          throw new Error('Failed to delete files, some files not found');
        }
      });
    tasks.push(removeFiles);

    const removeFolders = this.tx.folder
      .deleteMany({
        where: {
          rootId: rootId,
          lft: { gte: folder.lft },
          rgt: { lte: folder.rgt },
        },
      })
      .then((d) => d.count === flatFolders.length)
      .then((res) => {
        if (!res) {
          throw new Error('Failed to delete folders, some folders not found');
        }
      });

    tasks.push(removeFolders);

    // ===================== UPDATE SIZE =======================
    const diff = folder.rgt - folder.lft + 1;

    // udpate root
    tasks.push(
      this.tx.folder.updateMany({
        where: { id: folder.rootId },
        data: {
          rgt: { decrement: diff },
          size: { decrement: sizeRemoved.toNumber() },
          modifiedAt: new Date(),
        },
      }),
    );

    tasks.push(
      this.tx.folder.updateMany({
        where: { rootId, rgt: { gt: folder.rgt } },
        data: { rgt: { decrement: diff } },
      }),
      this.tx.folder.updateMany({
        where: { rootId, lft: { gt: folder.rgt } },
        data: { lft: { decrement: diff } },
      }),
    );
    await Promise.all(tasks);

    const event = new StorageEvent({
      type: 'folder_deleted',
      data: { files: fileIds, folders: flatFolders.map((f) => f.id) },
    });
    await this.storageQueue.emit(`storage.${rootId}`, event);
  }

  private async deleteFile(rootId: string, fileId: string) {
    const file = await this.tx.fileRef.findUnique({ where: { id: fileId } });
    if (!file) throw new BadRequestException('File not found');
    await this.tx.fileRef.delete({ where: file });
    await this.tx.folder.update({
      where: { id: rootId },
      data: { size: { decrement: file.size } },
    });

    const event = new StorageEvent({ type: 'file_deleted', data: [file.id] });
    await this.storageQueue.emit(`storage.${rootId}`, event);
  }
}
