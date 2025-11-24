import { MagicUser } from './types.js';
export declare class MagicUserStore {
    private users;
    private readonly filePath;
    constructor(rootDir: string);
    findOrCreate(emailRaw: string): MagicUser;
    private ensureDirectory;
    private load;
    private persist;
}
//# sourceMappingURL=UserStore.d.ts.map