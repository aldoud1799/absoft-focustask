const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const Store = require('./store');
const fs = require('fs');

let backupCreated = false;

// Initialize store
const store = new Store({
  configName: 'user-preferences',
  defaults: {
    tasks: [], // Simplified Schema
    settings: {
      theme: 'dark',
      accent: 'purple',
      autoAdvance: false
    }
  },
  onBackup: () => {
    backupCreated = true;
  }
});

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// MIGRATION: Convert Project > Tab structure to flat tasks
const currentProjects = store.get('projects');
let currentTasks = store.get('tasks') || [];

if (currentProjects && currentProjects.length > 0) {
  // Flatten all tasks from all projects and tabs
  const flattenedTasks = [];
  currentProjects.forEach(project => {
    if (project.tabs) {
      project.tabs.forEach(tab => {
        if (tab.tasks) {
          tab.tasks.forEach(task => {
            flattenedTasks.push(task);
          });
        }
      });
    }
  });
  
  // Merge with existing tasks if any, or just replace
  if (flattenedTasks.length > 0) {
    currentTasks = [...currentTasks, ...flattenedTasks];
    store.set('tasks', currentTasks);
  }
  
  // Clear projects to avoid re-migration and clean up
  store.set('projects', []);
}

let mainWindow;
let widgetWindow;
let quickAddWindow;
let tray;

function getIcon() {
  const iconPath = path.join(__dirname, 'APPLOGO.png');
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  // Fallback to assets/icon.png if APPLOGO doesn't exist
  const fallbackPath = path.join(__dirname, 'assets/icon.png');
  if (fs.existsSync(fallbackPath)) {
    return fallbackPath;
  }
  return nativeImage.createEmpty();
}

function createMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 500,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: getIcon()
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    if (backupCreated) {
      mainWindow.webContents.send('toast:backup', 'Backup created successfully');
      backupCreated = false;
    }
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createWidgetWindow() {
  let targetDisplay;
  
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    targetDisplay = screen.getDisplayMatching(bounds);
  } else {
    targetDisplay = screen.getPrimaryDisplay();
  }

  const { width, height, x, y } = targetDisplay.workArea; // Use workArea for absolute coordinates
  console.log(`Creating widget on display: ${width}x${height} at ${x},${y}`);
  
  // Position relative to the display's work area
  const xPos = x + width - 420;
  const yPos = y + 20;
  console.log(`Widget position: ${xPos}, ${yPos}`);
  
  widgetWindow = new BrowserWindow({
    width: 400,
    height: 80,
    x: xPos,
    y: yPos,
    frame: false,
    titleBarStyle: 'hidden', // macOS optimization
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false
  });

  widgetWindow.setAlwaysOnTop(true, 'screen-saver');
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  widgetWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Widget Console]: ${message}`);
  });

  widgetWindow.loadFile('widget.html');

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });
}

function createQuickAddWindow() {
  if (quickAddWindow) {
    quickAddWindow.show();
    quickAddWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  quickAddWindow = new BrowserWindow({
    width: 400,
    height: 60,
    x: width - 420,
    y: 110, // Positioned below the widget
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false
  });

  quickAddWindow.loadFile('quick-add.html');

  quickAddWindow.on('blur', () => {
    quickAddWindow.hide();
  });
  
  quickAddWindow.on('closed', () => {
    quickAddWindow = null;
  });
}

function createTray() {
  tray = new Tray(getIcon());
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => createMainWindow() },
    { label: 'Quit', click: () => {
      app.isQuitting = true;
      app.quit();
    }}
  ]);
  tray.setToolTip('Focus Task');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    createMainWindow();
  });
}

app.whenReady().then(() => {
  if (!gotTheLock) return; // Stop if we didn't get the lock

  createMainWindow();
  createWidgetWindow();
  createQuickAddWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  // Global Shortcuts
  globalShortcut.register('CommandOrControl+Alt+N', () => {
    createMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('shortcut:add-task');
    }
  });

  globalShortcut.register('CommandOrControl+Alt+W', () => {
    if (!widgetWindow) createWidgetWindow();
    
    if (widgetWindow.isVisible()) {
      widgetWindow.hide();
    } else {
      widgetWindow.show();
      widgetWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  globalShortcut.register('CommandOrControl+Alt+K', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createMainWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC Handlers
ipcMain.on('data:get', (event) => {
  event.returnValue = {
    tasks: store.get('tasks') || []
  };
});

ipcMain.on('data:save', (event, { tasks }) => {
  store.set('tasks', tasks);
  
  // Broadcast updates
  if (widgetWindow) widgetWindow.webContents.send('data:updated', { tasks });
  if (mainWindow) mainWindow.webContents.send('data:updated', { tasks });
});

ipcMain.on('task:complete', (event, taskId) => {
  const tasks = store.get('tasks') || [];
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.done = true;
    task.completedAt = new Date().toISOString();
    store.set('tasks', tasks);
    
    if (widgetWindow) widgetWindow.webContents.send('data:updated', { tasks });
    if (mainWindow) mainWindow.webContents.send('data:updated', { tasks });
  }
});

ipcMain.on('app:focus-mode', () => {
  console.log('IPC: app:focus-mode received');
  // if (mainWindow) {
  //   console.log('Hiding main window');
  //   mainWindow.hide();
  // }
  
  if (!widgetWindow) {
    console.log('Widget window does not exist, creating new one');
    createWidgetWindow();
  } else {
    console.log('Widget window exists');
  }
  
  if (widgetWindow.isMinimized()) {
    console.log('Restoring widget window');
    widgetWindow.restore();
  }
  
  console.log('Showing widget window');
  
  // Reset position to ensure it's visible on the current screen
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    const targetDisplay = screen.getDisplayMatching(bounds);
    const { width, x, y } = targetDisplay.workArea;
    widgetWindow.setPosition(x + width - 420, y + 20);
  }
  
  widgetWindow.show();
  widgetWindow.setAlwaysOnTop(true, 'screen-saver');
  widgetWindow.focus();
  
  // Send current data to widget
  const tasks = store.get('tasks') || [];
  const settings = store.get('settings');
  
  console.log('Sending data to widget');
  if (widgetWindow.webContents.isLoading()) {
    console.log('Widget is loading, waiting for did-finish-load');
    widgetWindow.webContents.once('did-finish-load', () => {
      console.log('Widget loaded, sending data');
      widgetWindow.webContents.send('data:updated', { tasks });
      widgetWindow.webContents.send('settings:updated', settings);
    });
  } else {
    console.log('Widget ready, sending data immediately');
    widgetWindow.webContents.send('data:updated', { tasks });
    widgetWindow.webContents.send('settings:updated', settings);
  }
});

ipcMain.on('app:restore', () => {
  // widgetWindow.hide();
  createMainWindow();
});

ipcMain.on('widget:set-ignore-mouse', (event, ignore) => {
  if (widgetWindow) {
    widgetWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('app:quit', () => {
  app.isQuitting = true;
  app.quit();
});

// Settings Handlers
ipcMain.on('settings:get', (event) => {
  event.returnValue = store.get('settings');
});

ipcMain.on('settings:save', (event, settings) => {
  store.set('settings', settings);
  // Broadcast to all windows
  if (mainWindow) mainWindow.webContents.send('settings:updated', settings);
  if (widgetWindow) widgetWindow.webContents.send('settings:updated', settings);
});

ipcMain.on('widget:close', () => {
  widgetWindow.hide();
});

ipcMain.on('widget:resize', (event, height) => {
  if (widgetWindow) {
    const [width] = widgetWindow.getSize();
    widgetWindow.setSize(width, Math.max(80, height));
  }
});

// Quick Add Handlers
ipcMain.on('quick-add:open', () => {
  if (!quickAddWindow) {
    createQuickAddWindow();
  }
  
  // Position relative to widget
  if (widgetWindow) {
    const bounds = widgetWindow.getBounds();
    quickAddWindow.setPosition(bounds.x, bounds.y + bounds.height + 10);
  }
  
  quickAddWindow.show();
  quickAddWindow.focus();
});

ipcMain.on('quick-add:submit', (event, text) => {
  console.log('IPC: quick-add:submit received:', text);
  if (!text) return;
  
  const tasks = store.get('tasks') || [];
  const newTask = {
    id: Date.now(),
    text: text,
    done: false,
    focused: true,
    createdAt: new Date().toISOString()
  };
  
  const updatedTasks = [...tasks, newTask];
  store.set('tasks', updatedTasks);
  console.log('Task added, broadcasting updates');
  
  // Broadcast updates
  if (mainWindow) mainWindow.webContents.send('data:updated', { tasks: updatedTasks });
  if (widgetWindow) widgetWindow.webContents.send('data:updated', { tasks: updatedTasks });
  
  if (quickAddWindow) quickAddWindow.hide();

  // Ensure widget is visible and on top (Focus Mode behavior)
  if (!widgetWindow) {
    createWidgetWindow();
  } else {
    if (widgetWindow.isMinimized()) widgetWindow.restore();
    widgetWindow.show();
    widgetWindow.setAlwaysOnTop(true, 'screen-saver');
    widgetWindow.focus();
  }
});

ipcMain.on('quick-add:close', () => {
  if (quickAddWindow) quickAddWindow.hide();
});

