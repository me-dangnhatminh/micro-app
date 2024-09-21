import { ConfigService } from '@nestjs/config';
import {
  MulterModuleOptions,
  MulterOptionsFactory,
} from '@nestjs/platform-express';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Module,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { MulterModule as NestMulter } from '@nestjs/platform-express';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Request } from 'express';
import Decimal from 'decimal.js';
import * as JSZip from 'jszip';
import { randomUUID as uuid } from 'crypto';
import * as RxJs from 'rxjs';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs-extra';

import { fileUtil } from 'src/common';

@Injectable()
export class DiskStorageService implements MulterOptionsFactory {
  private readonly logger = new Logger(DiskStorageService.name);
  private readonly destination: string;
  private readonly rootDir: string;
  private readonly folderDefaultName = 'Untitled';
  private readonly fileDefaultName = 'Untitled';

  constructor(private readonly configService: ConfigService<any, true>) {
    const rootDirConfigPath = 'storage.disk.rootDir';
    let rootDir = this.configService.get<string>(rootDirConfigPath) ?? '.temp';
    if (!rootDir) throw new Error(`Config not found: ${rootDirConfigPath}`);

    if (!path.isAbsolute(rootDir)) rootDir = path.resolve(rootDir);
    else rootDir = path.normalize(rootDir);

    const isExists = fs.existsSync(rootDir);

    if (isExists) {
      const isDir = fs.statSync(rootDir).isDirectory();
      if (!isDir) throw new Error(`${rootDir} is not a directory`);
      try {
        fs.accessSync(rootDir, fs.constants.W_OK);
      } catch (error) {
        throw new Error(`${rootDir} is not writable`);
      }
    } else {
      fs.mkdirSync(rootDir, { recursive: true });
    }

    this.rootDir = rootDir;
    this.destination = rootDir;
    const msg = `Root dir: ${rootDir}\nStatus (exites/created): ${isExists ? 'exists' : 'created'}`;
    this.logger.log(msg);
  }

  createMulterOptions(): MulterModuleOptions {
    return {
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          Object.assign(file, { destination: this.destination });
          return cb(null, this.destination);
        },
        filename: (req: Request, file: Express.Multer.File, cb) => {
          const { destination } = file;

          const id = uuid();
          const filename = `${id}`;
          const fullpath = path.join(destination, filename);
          file.path = fullpath;

          /**
           * req.setMaxListeners(Infinity)
           * (node:8908) MaxListenersExceededWarning: Possible EventEmitter memory leak detected
           */
          req.setMaxListeners(Infinity);
          const rollback = () =>
            req.on(ROLLBACK_EVENT, () => fs.unlink(file.path));
          file.stream.on('end', rollback);
          // don't listen req.on "close" or "error"

          cb(null, filename);
        },
      }),
    };
  }

  filePath(name: string) {
    const fullPath = path.join(this.rootDir, name);
    const isExists = fs.existsSync(fullPath);
    return { fullPath, isExists };
  }

  saveFile(name: string, buffer: Buffer) {
    const { fullPath, isExists } = this.filePath(name);
    if (isExists) throw new Error(`File already exists: ${fullPath}`);
    fs.writeFileSync(fullPath, buffer);
  }

  async buildZipAsync(
    folderName: string,
    flatFolders: {
      id: string;
      name: string;
      parentId: string | null;
      depth: number;
      files: {
        file: {
          size: number | bigint;
          id: string;
          name: string;
          contentType: string;
        };
      }[];
    }[],
  ) {
    const totalSize = flatFolders.reduce((acc, f) => {
      return f.files.reduce((acc, ff) => {
        return acc.add(new Decimal(ff.file.size.toString()));
      }, acc);
    }, new Decimal(0));

    // Child is flat, need to convert to tree
    // =========================== Calculate pathTree ===========================
    type PathTree = Record<string, string>; // [id, path]
    const pathTree: PathTree = {};
    const pathUsed: Record<string, boolean> = {}; // [path, used]
    type FileSM = { id: string; name: string; contentType: string };
    type FileTree = Record<string, FileSM>;
    const fileTree: FileTree = {}; // for file

    flatFolders.forEach((f) => {
      const parentId = f.parentId ?? f.id;
      const pathParent = pathTree[parentId] ?? '';
      f.name = fileUtil.formatName(f.name);
      let name = f.name === '' ? this.folderDefaultName : f.name;

      for (let i = 0; pathUsed[`${pathParent}/${name}`]; i++) {
        name = `${f.name}(${i})`;
      }
      pathUsed[`${pathParent}/${name}`] = true;
      pathTree[f.id] = `${pathParent}/${name}`.replace(/^\//, ''); // remove leading slash

      f.files.forEach((ff) => {
        ff.file.name = fileUtil.formatName(ff.file.name, '_');
        let filename = ff.file.name === '' ? 'Untitled' : ff.file.name;
        for (let i = 0; fileTree[`${pathTree[f.id]}/${filename}`]; i++) {
          filename = `${ff.file.name}(${i})`;
        }
        const _ = `${pathTree[f.id]}/${filename}`.replace(/^\//, ''); // remove leading slash
        fileTree[_] = ff.file;
      });
    });

    // =========================== Create zip ===========================
    let rootName = folderName === '' ? this.folderDefaultName : folderName;
    rootName = fileUtil.formatAndEncode(rootName);
    const zip = new JSZip();
    Object.values(pathTree).forEach((foldername) =>
      zip.file(foldername, null, { dir: true }),
    );

    const promises = Object.entries(fileTree).map(([filepath, file]) => {
      const filePath = this.filePath(file.id);
      if (!filePath.isExists) throw new Error(`File not found: ${file.id}`);
      return zip.file(filepath, fs.readFileSync(filePath.fullPath));
    });

    await Promise.all(promises);

    return {
      zip,
      foldername: `${rootName}-${Date.now()}.zip`,
      totalSize: totalSize.toNumber(),
    };
  }
}
export type Zipped = Awaited<ReturnType<DiskStorageService['buildZipAsync']>>;

const ROLLBACK_EVENT = Symbol('file-rollback');
@Injectable()
export class FileRollback implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): RxJs.Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const emitRollback = (err: unknown) => request.emit(ROLLBACK_EVENT, err);
    return next.handle().pipe(RxJs.tap({ error: emitRollback }));
  }
}

@Module({
  providers: [DiskStorageService],
  exports: [DiskStorageService],
})
class DiskStorageModule {}
@Module({
  imports: [
    DiskStorageModule,
    NestMulter.registerAsync({
      imports: [DiskStorageModule],
      useExisting: DiskStorageService,
    }),
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: FileRollback }],
  exports: [DiskStorageModule, NestMulter],
})
export class MulterModule {}
