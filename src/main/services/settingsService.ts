import { Settings, SettingsAPI, ServerConfigInfo } from '@shared/types'
import { app, nativeTheme } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import EventEmitter from 'events'

class SettingsService extends EventEmitter implements SettingsAPI {
  private settings: Settings
  private settingsPath: string

  constructor() {
    super()
    this.settingsPath = join(app.getPath('userData'), 'settings.json')

    // Default settings
    this.settings = {
      downloadPath: join(app.getPath('userData'), 'downloads'),
      downloadSpeedLimit: 0,
      uploadSpeedLimit: 0,
      hideAdultContent: true,
      colorScheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      serverConfig: { baseUri: '', password: '' }
    }

    // Load settings from disk
    this.loadSettings()
  }

  getDownloadPath(): string {
    return this.settings.downloadPath
  }

  setDownloadPath(path: string): void {
    this.settings.downloadPath = path
    this.saveSettings()
    this.emit('download-path-changed', path)
  }

  getDownloadSpeedLimit(): number {
    return this.settings.downloadSpeedLimit
  }

  setDownloadSpeedLimit(limit: number): void {
    this.settings.downloadSpeedLimit = limit
    this.saveSettings()
    this.emit('download-speed-limit-changed', limit)
  }

  getUploadSpeedLimit(): number {
    return this.settings.uploadSpeedLimit
  }

  setUploadSpeedLimit(limit: number): void {
    this.settings.uploadSpeedLimit = limit
    this.saveSettings()
    this.emit('upload-speed-limit-changed', limit)
  }

  getColorScheme(): 'light' | 'dark' {
    return this.settings.colorScheme
  }

  setColorScheme(scheme: 'light' | 'dark'): void {
    this.settings.colorScheme = scheme
    this.saveSettings()
    this.emit('color-scheme-changed', scheme)
  }

  getServerConfig(): ServerConfigInfo {
    return {
      baseUri: this.settings.serverConfig?.baseUri ?? '',
      password: this.settings.serverConfig?.password ?? ''
    }
  }

  setServerConfig(config: ServerConfigInfo): void {
    this.settings.serverConfig = {
      baseUri: config.baseUri ?? '',
      password: config.password ?? ''
    }
    this.saveSettings()
    this.emit('server-config-changed', this.settings.serverConfig)
  }

  private loadSettings(): void {
    try {
      const exists = existsSync(this.settingsPath)
      if (exists) {
        const data = readFileSync(this.settingsPath, 'utf-8')
        const loadedSettings = JSON.parse(data)
        this.settings = { ...this.settings, ...loadedSettings }
        console.log('Settings loaded successfully')
      } else {
        console.log('No settings file found, using defaults')
        // Create the settings file with default values
        this.saveSettings()
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  private saveSettings(): void {
    try {
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8')
      console.log('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }
}

export default new SettingsService()
