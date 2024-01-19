import Dexie from 'dexie'

export interface Backup {
    id: string
    time: number
    json: any
}

export class BackupDb extends Dexie {
    backups!: Dexie.Table<Backup, string>

    constructor() {
        super("Backup")
        this.version(1).stores({
            backups: 'id, time',
        })
    }
}

export const db = new BackupDb()

export const MAX_BACKUP_AGE = 7 /* days */ * 24 /* hours */ * 60 /* min */ * 60 /* sec */ * 1000 /* milli */

export async function removeOldBackups() {
    const oldest = Date.now() - MAX_BACKUP_AGE
    await db.backups.where('time').below(oldest).delete()
}

export function storeBackup(id: string, json: any) {
    return db.backups.put({ id, time: Date.now(), json })
}
