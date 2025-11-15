import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

class RestoreService {
  constructor() {
    this.config = {
      mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/petrolpump',
      backupDir: process.env.BACKUP_DIR || './mongodb-backups'
    };
  }

  async listBackups() {
    const backupDir = this.config.backupDir;
    
    if (!fs.existsSync(backupDir)) {
      return [];
    }
    
    const backups = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup-'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          name: file,
          created: stats.mtime,
          path: filePath
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return backups;
  }

  async restoreBackup(backupName, options = {}) {
    return new Promise((resolve, reject) => {
      const backupPath = path.join(this.config.backupDir, backupName);
      
      if (!fs.existsSync(backupPath)) {
        reject(new Error(`Backup not found: ${backupName}`));
        return;
      }
      
      console.log(`🔄 Restoring from backup: ${backupName}`);
      
      if (options.dropDatabase) {
        this.dropDatabase().then(() => {
          this.performRestore(backupPath, resolve, reject);
        }).catch(reject);
      } else {
        this.performRestore(backupPath, resolve, reject);
      }
    });
  }

  async dropDatabase() {
    return new Promise((resolve, reject) => {
      const dropCommand = `mongo "${this.config.mongodbUri}" --eval "db.dropDatabase()"`;
      
      exec(dropCommand, (error) => {
        if (error) {
          console.log('⚠️ Could not drop database (might not exist), continuing...');
        }
        resolve();
      });
    });
  }

  performRestore(backupPath, resolve, reject) {
    const restoreCommand = `mongorestore --uri="${this.config.mongodbUri}" "${backupPath}"`;
    
    exec(restoreCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Restore failed:', error);
        reject(error);
        return;
      }
      
      console.log('✅ Database restored successfully!');
      resolve({
        success: true,
        message: 'Database restored successfully',
        backupPath,
        restoredAt: new Date().toISOString()
      });
    });
  }

  async getBackupInfo(backupName) {
    const backupPath = path.join(this.config.backupDir, backupName);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupName}`);
    }
    
    const stats = fs.statSync(backupPath);
    const size = this.calculateDirectorySize(backupPath);
    
    const isValid = this.isValidMongoBackup(backupPath);
    
    return {
      name: backupName,
      path: backupPath,
      created: stats.mtime,
      size: (size / (1024 * 1024)).toFixed(2) + ' MB',
      isValid: isValid
    };
  }

  calculateDirectorySize(dirPath) {
    let totalSize = 0;
    
    const calculateSize = (currentPath) => {
      const stats = fs.statSync(currentPath);
      
      if (stats.isDirectory()) {
        const files = fs.readdirSync(currentPath);
        files.forEach(file => {
          calculateSize(path.join(currentPath, file));
        });
      } else {
        totalSize += stats.size;
      }
    };
    
    calculateSize(dirPath);
    return totalSize;
  }

  isValidMongoBackup(backupPath) {
    try {
      const files = fs.readdirSync(backupPath, { recursive: true });
      return files.some(file => file.endsWith('.bson'));
    } catch (error) {
      return false;
    }
  }
}

export default new RestoreService();