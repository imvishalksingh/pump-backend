import backupService from "../utils/backupService.js";

// Create manual backup
export const createBackup = async (req, res) => {
  try {
    console.log('🚀 Manual backup requested');
    
    const result = await backupService.createBackup();
    
    res.status(200).json({
      success: true,
      message: 'Backup created successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Backup controller error:', error);
    console.error('❌ Backup error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup',
      error: error.message
    });
  }
};

// Get backup status - FIXED VERSION
// Get backup status
export const getBackupStatus = async (req, res) => {
  console.log('🔍 [CONTROLLER] getBackupStatus called at:', new Date().toISOString());
  console.log('👤 [CONTROLLER] User making request:', req.user?.email || 'No user');
  
  try {
    console.log('📊 [CONTROLLER] Calling backupService.getBackupStatus()');
    const status = await backupService.getBackupStatus();
    
    console.log('✅ [CONTROLLER] Backup status result:', JSON.stringify(status, null, 2));
    
    // Ensure response is properly formatted
    const response = {
      success: true,
      data: status
    };
    
    console.log('📤 [CONTROLLER] Sending response...');
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ [CONTROLLER] getBackupStatus CATCH BLOCK TRIGGERED:');
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);
    
    const errorResponse = {
      success: false,
      message: 'Failed to get backup status: ' + error.message,
      error: error.message,
      data: {
        status: 'error',
        message: 'Service temporarily unavailable',
        totalBackups: 0,
        latestBackup: null,
        lastBackupTime: null,
        backupSize: '0 MB',
        backups: []
      }
    };
    
    res.status(500).json(errorResponse);
  }
};

// List all backups
export const listBackups = async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    
    res.status(200).json({
      success: true,
      data: {
        backups: backups,
        total: backups.length
      }
    });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list backups',
      error: error.message
    });
  }
};

// Download backup
export const downloadBackup = async (req, res) => {
  try {
    const { backupName } = req.params;
    
    const backups = await backupService.listBackups();
    const backup = backups.find(b => b.name === backupName);
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: backup,
      message: 'Download functionality would be implemented here'
    });
  } catch (error) {
    console.error('Download backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to prepare backup download',
      error: error.message
    });
  }
};