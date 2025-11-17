import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { MagicUser } from './types.js';

export class MagicUserStore {
  private users: Map<string, MagicUser> = new Map();
  private readonly filePath: string;

  constructor(rootDir: string) {
    this.filePath = path.join(rootDir, 'magic-users.json');
    this.ensureDirectory();
    this.load();
  }

  findOrCreate(emailRaw: string): MagicUser {
    const email = emailRaw.trim().toLowerCase();
    let user = this.users.get(email);
    if (user) {
      user = { ...user, updatedAt: new Date().toISOString() };
      this.users.set(email, user);
      void this.persist();
      return user;
    }

    const now = new Date().toISOString();
    user = {
      id: randomUUID(),
      email,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(email, user);
    void this.persist();
    return user;
  }

  private ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load() {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as MagicUser[];
      for (const user of data) {
        this.users.set(user.email, user);
      }
    } catch (error) {
      console.warn('MagicUserStore load error, continuing with empty store', error);
    }
  }

  private async persist() {
    try {
      const data = JSON.stringify(Array.from(this.users.values()), null, 2);
      await fs.promises.writeFile(this.filePath, data, 'utf-8');
    } catch (error) {
      console.warn('MagicUserStore persist error:', error);
    }
  }
}
