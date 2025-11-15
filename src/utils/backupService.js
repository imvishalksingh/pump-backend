import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

class BackupService {
  constructor() {
    this.config = {
      mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/petrolpump',
      backupDir: process.env.BACKUP_DIR || './mongodb-backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30
    };

    console.log('🔧 Backup Service Initialized');
    console.log('📁 Backup Directory:', this.config.backupDir);
    console.log('🗓️ Retention Days:', this.config.retentionDays);

    this.init();
  }

  init() {
    // Create backup directory if not exists
    try {
      if (!fs.existsSync(this.config.backupDir)) {
        fs.mkdirSync(this.config.backupDir, { recursive: true });
        console.log('✅ Created backup directory');
      }
    } catch (error) {
      console.error('❌ Failed to create backup directory:', error);
    }

    // Schedule daily backup at 2 AM
    this.scheduleDailyBackup();
  }

  async createBackup() {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.config.backupDir, `backup-${timestamp}`);
        
        console.log(`🔄 Creating backup at: ${backupPath}`);
        
        // Create backup directory
        if (!fs.existsSync(backupPath)) {
          fs.mkdirSync(backupPath, { recursive: true });
        }

        // Use simple command without URI (connect to local MongoDB)
        const command = `mongodump --out "${backupPath}"`;
        
        console.log(`📝 Executing: ${command}`);
        
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error('❌ Backup command failed:', error);
            console.error('🔧 stderr:', stderr);
            
            // Provide helpful error message
            let errorMessage = 'Backup failed: ';
            
            if (stderr.includes('not recognized')) {
              errorMessage += 'MongoDB tools not installed. Please install MongoDB Database Tools.';
            } else if (stderr.includes('connect')) {
              errorMessage += 'Cannot connect to MongoDB. Please ensure MongoDB is running.';
            } else {
              errorMessage += stderr || error.message;
            }
            
            reject(new Error(errorMessage));
            return;
          }
          
          console.log('✅ Backup completed successfully!');
          console.log('📄 Output:', stdout);
          
          // Check if backup actually created files
          const backupFiles = fs.readdirSync(backupPath);
          console.log(`📁 Backup created ${backupFiles.length} files/folders`);
          
          this.cleanupOldBackups();
          
          resolve({
            success: true,
            backupPath,
            timestamp: new Date().toISOString(),
            fileCount: backupFiles.length,
            message: 'Backup created successfully'
          });
        });
      } catch (error) {
        console.error('❌ Backup setup failed:', error);
        reject(new Error(`Backup setup failed: ${error.message}`));
      }
    });
  }

  cleanupOldBackups() {
    try {
      if (!fs.existsSync(this.config.backupDir)) {
        return;
      }

      const files = fs.readdirSync(this.config.backupDir);
      const now = Date.now();
      const retentionTime = this.config.retentionDays * 24 * 60 * 60 * 1000;

      let deletedCount = 0;
      
      files.forEach(file => {
        if (!file.startsWith('backup-')) return;
        
        const filePath = path.join(this.config.backupDir, file);
        try {
          const stat = fs.statSync(filePath);
          
          if (now - stat.mtimeMs > retentionTime) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`🗑️ Deleted old backup: ${file}`);
            deletedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to delete backup ${file}:`, error.message);
        }
      });

      if (deletedCount > 0) {
        console.log(`🗑️ Cleaned up ${deletedCount} old backups`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old backups:', error);
    }
  }

  scheduleDailyBackup() {
    // Run daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('⏰ Running scheduled daily backup...');
      try {
        await this.createBackup();
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error.message);
      }
    });

    console.log('✅ Automated backups scheduled daily at 2 AM');
  }


async getBackupStatus() {
  console.log('🔧 [BACKUP SERVICE] getBackupStatus() called at:', new Date().toISOString());
  
  try {
    const backupDir = this.config.backupDir;
    console.log('📁 [BACKUP SERVICE] Backup directory:', backupDir);
    
    // Check if directory exists
    if (!fs.existsSync(backupDir)) {
      console.log('📁 [BACKUP SERVICE] Directory does not exist, creating...');
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('✅ [BACKUP SERVICE] Directory created');
      
      return {
        status: 'no_backups',
        message: 'No backups found - directory was just created',
        totalBackups: 0,
        latestBackup: null,
        lastBackupTime: null,
        backupSize: '0 MB',
        backups: []
      };
    }

    // Read directory
    console.log('📁 [BACKUP SERVICE] Reading directory...');
    const files = fs.readdirSync(backupDir);
    console.log('📁 [BACKUP SERVICE] Files found:', files);
    
    const backups = files.filter(file => file.startsWith('backup-'));
    console.log('📁 [BACKUP SERVICE] Backup files:', backups);

    if (backups.length === 0) {
      console.log('📁 [BACKUP SERVICE] No backup files found');
      return {
        status: 'no_backups',
        message: 'No backup files found',
        totalBackups: 0,
        latestBackup: null,
        lastBackupTime: null,
        backupSize: '0 MB',
        backups: []
      };
    }

    // Get latest backup
    const sortedBackups = backups.sort().reverse();
    const latestBackup = sortedBackups[0];
    console.log('📁 [BACKUP SERVICE] Latest backup:', latestBackup);
    
    const backupPath = path.join(backupDir, latestBackup);
    console.log('📁 [BACKUP SERVICE] Backup path:', backupPath);
    
    const stats = fs.statSync(backupPath);
    console.log('📁 [BACKUP SERVICE] Backup stats obtained');
    
    // Calculate backup size properly
    let backupSize = '0 MB';
    try {
      const sizeInBytes = this.calculateDirectorySizeSafe(backupPath);
      const sizeInMB = sizeInBytes / (1024 * 1024);
      backupSize = sizeInMB > 0 ? sizeInMB.toFixed(2) + ' MB' : '0 MB';
      console.log('📊 [BACKUP SERVICE] Backup size calculated:', backupSize);
    } catch (sizeError) {
      console.warn('⚠️ [BACKUP SERVICE] Size calculation failed, using fallback:', sizeError.message);
      // Fallback: use directory stats size (less accurate but works)
      const fallbackSize = stats.size / (1024 * 1024);
      backupSize = fallbackSize > 0 ? fallbackSize.toFixed(2) + ' MB' : 'Unknown';
    }
    
    // Ensure all dates are serializable
    const lastBackupTime = stats.mtime ? stats.mtime.toISOString() : null;
    
    console.log('✅ [BACKUP SERVICE] Status check successful');
    
    // Return properly formatted response
    return {
      status: 'active',
      totalBackups: backups.length,
      latestBackup: latestBackup,
      lastBackupTime: lastBackupTime,
      backupSize: backupSize,
      backups: sortedBackups.slice(0, 10),
      message: 'Backup system is active'
    };
    
  } catch (error) {
    console.error('❌ [BACKUP SERVICE] getBackupStatus ERROR:');
    console.error('   - Error:', error.message);
    console.error('   - Error stack:', error.stack);
    
    // Return error response that won't cause serialization issues
    return {
      status: 'error',
      message: 'Error: ' + error.message,
      totalBackups: 0,
      latestBackup: null,
      lastBackupTime: null,
      backupSize: '0 MB',
      backups: []
    };
  }
}

// Safe directory size calculation without recursion
calculateDirectorySizeSafe(dirPath) {
  let totalSize = 0;
  
  try {
    const stack = [dirPath];
    
    while (stack.length > 0) {
      const currentPath = stack.pop();
      
      try {
        const stats = fs.statSync(currentPath);
        
        if (stats.isDirectory()) {
          // Read directory contents
          let files;
          try {
            files = fs.readdirSync(currentPath);
          } catch (readError) {
            console.warn(`⚠️ Cannot read directory: ${currentPath}`, readError.message);
            continue; // Skip this directory
          }
          
          // Add all files and subdirectories to stack
          files.forEach(file => {
            // Skip common system files that might cause issues
            if (file.startsWith('.') || file === 'node_modules' || file === 'Thumbs.db') {
              return;
            }
            stack.push(path.join(currentPath, file));
          });
        } else {
          // It's a file, add its size
          totalSize += stats.size;
        }
      } catch (statError) {
        console.warn(`⚠️ Cannot access: ${currentPath}`, statError.message);
        // Continue with next item in stack
      }
    }
  } catch (error) {
    console.error('❌ Directory size calculation failed:', error);
    throw error;
  }
  
  return totalSize;
}

  async listBackups() {
  const backupDir = this.config.backupDir;
  
  if (!fs.existsSync(backupDir)) {
    return [];
  }
  
  try {
    const backups = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup-'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        try {
          const stats = fs.statSync(filePath);
          let size = 'Unknown';
          
          try {
            const sizeInBytes = this.calculateDirectorySizeSafe(filePath);
            const sizeInMB = sizeInBytes / (1024 * 1024);
            size = sizeInMB > 0 ? sizeInMB.toFixed(2) + ' MB' : '0 MB';
          } catch (sizeError) {
            console.warn(`⚠️ Size calculation failed for ${file}:`, sizeError.message);
            // Fallback to directory stats
            const fallbackSize = stats.size / (1024 * 1024);
            size = fallbackSize > 0 ? fallbackSize.toFixed(2) + ' MB' : 'Unknown';
          }
          
          return {
            name: file,
            created: stats.mtime,
            size: size,
            path: filePath
          };
        } catch (error) {
          console.error(`❌ Error reading backup ${file}:`, error);
          return {
            name: file,
            created: new Date(),
            size: 'Unknown',
            path: filePath,
            error: error.message
          };
        }
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return backups;
  } catch (error) {
    console.error('❌ Error listing backups:', error);
    return [];
  }
}
}

export default new BackupService();