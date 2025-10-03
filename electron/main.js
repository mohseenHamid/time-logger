import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import Store from 'electron-store'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize electron-store
const store = new Store()

let mainWindow = null
let quickEntryWindow = null
let tray = null

const isDev = process.env.NODE_ENV !== 'production'
const VITE_DEV_SERVER_URL = 'http://localhost:5173'

function createMainWindow() {
  console.log('🪟 Creating main window...')
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  })

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    // Only open dev tools if explicitly requested
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createQuickEntryWindow() {
  console.log('⚡ Creating quick entry window...')
  quickEntryWindow = new BrowserWindow({
    width: 500,
    height: 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  })

  if (isDev) {
    quickEntryWindow.loadURL(`${VITE_DEV_SERVER_URL}#quick-entry`)
  } else {
    quickEntryWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'quick-entry' })
  }

  // Hide when loses focus
  quickEntryWindow.on('blur', () => {
    if (quickEntryWindow && !quickEntryWindow.isDestroyed()) {
      quickEntryWindow.hide()
    }
  })

  quickEntryWindow.on('closed', () => {
    quickEntryWindow = null
  })
}

function showQuickEntry() {
  if (!quickEntryWindow || quickEntryWindow.isDestroyed()) {
    createQuickEntryWindow()
  }
  
  quickEntryWindow.center()
  quickEntryWindow.show()
  quickEntryWindow.focus()
  quickEntryWindow.webContents.send('focus-input')
}

function createTray() {
  // Create a simple icon for the tray (you can replace with actual icon file)
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Quick Entry (Ctrl+Shift+T or Ctrl+Alt+T)', 
      click: () => showQuickEntry()
    },
    { 
      label: 'Show Main Window', 
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createMainWindow()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])
  
  tray.setToolTip('Time Logger')
  tray.setContextMenu(contextMenu)
  
  // Double click to show main window
  tray.on('double-click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    createMainWindow()
    createQuickEntryWindow()
    createTray()

  // Register global shortcut: Ctrl+Shift+T
  const ret = globalShortcut.register('CommandOrControl+Shift+T', () => {
    showQuickEntry()
  })

  if (!ret) {
    console.log('⚠️  Global shortcut Ctrl+Shift+T registration failed')
    console.log('   This might be because:')
    console.log('   - Another app is using this shortcut')
    console.log('   - Try Ctrl+Alt+T instead')
    console.log('   - Use system tray or main window instead')
    
    // Try alternative shortcut
    const altRet = globalShortcut.register('CommandOrControl+Alt+T', () => {
      showQuickEntry()
    })
    
    if (altRet) {
      console.log('✅ Alternative shortcut Ctrl+Alt+T registered successfully')
    } else {
      console.log('❌ Alternative shortcut also failed - use tray icon instead')
    }
  } else {
    console.log('✅ Global shortcut Ctrl+Shift+T registered successfully')
  }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })
}

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers for storage
ipcMain.handle('store-get', (event, key) => {
  return store.get(key)
})

ipcMain.handle('store-set', (event, key, value) => {
  store.set(key, value)
  
  // Notify all windows about the data change
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('store-updated', key, value)
  })
  
  return true
})

ipcMain.handle('store-delete', (event, key) => {
  store.delete(key)
  return true
})

// Handle quick entry submission
ipcMain.on('quick-entry-submitted', () => {
  if (quickEntryWindow && !quickEntryWindow.isDestroyed()) {
    quickEntryWindow.hide()
  }
})

// Handle window controls
ipcMain.on('hide-quick-entry', () => {
  if (quickEntryWindow && !quickEntryWindow.isDestroyed()) {
    quickEntryWindow.hide()
  }
})
