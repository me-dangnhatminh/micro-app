import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { TransactionHost } from '@nestjs-cls/transactional';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as z from 'zod';

import { FolderInfo, PastTime, UUID } from 'src/domain';

export const FolderCreateDTO = z.object({
  name: z.string(),
  createdAt: PastTime.default(new Date()),
  pinnedAt: PastTime.nullable().default(null),
  modifiedAt: PastTime.nullable().default(null),
  archivedAt: PastTime.nullable().default(null),
});
export type FolderCreateDTO = z.infer<typeof FolderCreateDTO>;

export class FolderCreateCmd implements ICommand {
  constructor(
    public readonly folderId: string,
    public readonly item: FolderInfo,
    public readonly accssorId: string,
  ) {
    try {
      UUID.parse(folderId);
      FolderInfo.parse(item);
    } catch (error) {
      if (error instanceof Error) {
        const msg = `${FolderCreateCmd.name}: invalid input ${error.message}`;
        throw new Error(msg);
      }
      throw error;
    }
  }
}

@CommandHandler(FolderCreateCmd)
export class FolderCreateHandler implements ICommandHandler<FolderCreateCmd> {
  private readonly tx: PrismaClient;
  constructor(private readonly txHost: TransactionHost) {
    this.tx = this.txHost.tx as PrismaClient; // TODO: not shure this run
  }

  async execute(command: FolderCreateCmd) {
    const item = command.item;
    const folder = await this.tx.folder.findUnique({
      where: { id: command.folderId, archivedAt: null },
    });
    if (!folder) throw new NotFoundException('Folder not found');
    if (folder.archivedAt) throw new BadRequestException('Folder is archived');
    if (folder.ownerId !== command.accssorId)
      throw new ForbiddenException('User not owner of folder');
    const tasks: Promise<unknown>[] = [];
    const rootId = folder.rootId ?? folder.id;
    // extend root
    tasks.push(
      this.tx.folder.update({
        where: { id: rootId, lft: 0, depth: 0 },
        data: { rgt: { increment: 2 } },
      }),
    );

    // extend right siblings
    const isRoot = folder.rootId === folder.id;
    if (!isRoot) {
      tasks.push(
        this.tx.folder.updateMany({
          where: { rootId, rgt: { gte: folder.rgt } },
          data: { rgt: { increment: 2 } },
        }),
        this.tx.folder.updateMany({
          where: { rootId, lft: { gt: folder.rgt } },
          data: { lft: { increment: 2 } },
        }),
      );
    }

    tasks.push(
      this.tx.folder.create({
        data: {
          id: item.id,
          name: item.name,
          size: 0,
          createdAt: new Date(),
          ownerId: item.ownerId,
          archivedAt: null,
          pinnedAt: null,
          modifiedAt: null,
          rootId: rootId,
          parentId: folder.id,
          lft: folder.rgt,
          rgt: folder.rgt + 1,
          depth: folder.depth + 1,
        },
      }),
    );
    await Promise.all(tasks);
  }
}
