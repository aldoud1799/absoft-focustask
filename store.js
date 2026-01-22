const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor(opts) {
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, opts.configName + '.json');
    this.defaults = opts.defaults;
    this.data = parseDataFile(this.path, opts.defaults);
    this.saveTimeout = null;
    
    // Check for backup
    this.checkBackup(userDataPath, opts.configName, opts.onBackup);
  }

  get(key) {
    return this.data[key];
  }

  set(key, val) {
    this.data[key] = val;
    
    // Debounce save
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        fs.writeFileSync(this.path, JSON.stringify(this.data));
      } catch(e) {
        console.error('Failed to save data:', e);
      }
    }, 500);
  }

  checkBackup(userDataPath, configName, onBackup) {
    const now = Date.now();
    const lastBackup = this.data.lastBackup || 0;
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (now - lastBackup > ONE_DAY) {
      const backupPath = path.join(userDataPath, configName + '-backup.json');
      try {
        fs.writeFileSync(backupPath, JSON.stringify(this.data));
        this.data.lastBackup = now;
        // Save immediately to update timestamp
        fs.writeFileSync(this.path, JSON.stringify(this.data));
        
        if (onBackup) onBackup();
      } catch (e) {
        console.error('Backup failed:', e);
      }
    }
  }
}

function parseDataFile(filePath, defaults) {
  try {
    return JSON.parse(fs.readFileSync(filePath));
  } catch(error) {
    // If file exists but is corrupted, back it up before returning defaults
    // so the user doesn't lose data if "defaults" are saved over it.
    if (fs.existsSync(filePath)) {
        try {
            fs.copyFileSync(filePath, filePath + '.corrupted.' + Date.now());
            console.warn('Corrupted data file backed up.');
        } catch(copyErr) {
            console.error('Failed to backup corrupted file:', copyErr);
        }
    }
    return defaults;
  }
}

module.exports = Store;
