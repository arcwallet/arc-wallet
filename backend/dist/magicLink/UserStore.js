import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
export class MagicUserStore {
    users = new Map();
    filePath;
    constructor(rootDir) {
        this.filePath = path.join(rootDir, 'magic-users.json');
        this.ensureDirectory();
        this.load();
    }
    findOrCreate(emailRaw) {
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
    ensureDirectory() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    load() {
        if (!fs.existsSync(this.filePath)) {
            return;
        }
        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const data = JSON.parse(raw);
            for (const user of data) {
                this.users.set(user.email, user);
            }
        }
        catch (error) {
            console.warn('MagicUserStore load error, continuing with empty store', error);
        }
    }
    async persist() {
        try {
            const data = JSON.stringify(Array.from(this.users.values()), null, 2);
            await fs.promises.writeFile(this.filePath, data, 'utf-8');
        }
        catch (error) {
            console.warn('MagicUserStore persist error:', error);
        }
    }
}
//# sourceMappingURL=UserStore.js.map