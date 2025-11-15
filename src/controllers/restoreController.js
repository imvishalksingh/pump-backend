import restoreService from "../utils/restoreService.js";

// List available backups for restore
export const listBackupsForRestore = async (req, res) => {
  try {
    const backups = await restoreService.listBackups();
    
    res.status(200).json({
      success: true,
      data: {
        backups: backups,
        total: backups.length
      }
    });
  } catch (error) {
    console.error('List backups for restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list backups',
      error: error.message
    });
  }
};

// Get backup info
export const getBackupInfo = async (req, res) => {
  try {
    const { backupName } = req.params;
    
    const backupInfo = await restoreService.getBackupInfo(backupName);
    
    res.status(200).json({
      success: true,
      data: backupInfo
    });
  } catch (error) {
    console.error('Get backup info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get backup info',
      error: error.message
    });
  }
};

// Restore from backup
export const restoreBackup = async (req, res) => {
  try {
    const { backupName } = req.params;
    const { dropDatabase = true } = req.body;
    
    console.log(`🔄 Restore requested for: ${backupName}`);
    
    const result = await restoreService.restoreBackup(backupName, { dropDatabase });
    
    res.status(200).json({
      success: true,
      message: 'Database restored successfully',
      data: result
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore database',
      error: error.message
    });
  }
};

// Validate backup
export const validateBackup = async (req, res) => {
  try {
    const { backupName } = req.params;
    
    const backupInfo = await restoreService.getBackupInfo(backupName);
    
    res.status(200).json({
      success: true,
      data: {
        isValid: backupInfo.isValid,
        backup: backupInfo
      }
    });
  } catch (error) {
    console.error('Validate backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate backup',
      error: error.message
    });
  }
};