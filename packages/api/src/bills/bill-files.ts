import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';

import { Injectable } from '@nestjs/common';

@Injectable()
export class BillFiles {
  root(): string {
    return path.resolve(process.env.BILL_STORAGE_DIR ?? path.join(process.cwd(), 'data', 'bills'));
  }

  async save(organisationId: string, extension: string, bytes: Buffer): Promise<string> {
    const relative = path.posix.join(organisationId, `${randomUUID()}${extension}`);
    const absolute = this.resolve(relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
    return relative;
  }

  async read(relative: string): Promise<Buffer> {
    return readFile(this.resolve(relative));
  }

  async remove(relative: string): Promise<void> {
    await rm(this.resolve(relative), { force: true });
  }

  private resolve(relative: string): string {
    const root = this.root();
    const absolute = path.resolve(root, relative);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new Error('Bill path escapes storage.');
    }
    return absolute;
  }
}
