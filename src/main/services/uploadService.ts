import { app, BrowserWindow } from 'electron'
import { promises as fs, existsSync } from 'fs'
import { join, dirname } from 'path'
import { EventEmitter } from 'events'
import crypto from 'crypto'
import { execa } from 'execa'
import adbService from './adbService'
import dependencyService from './dependencyService'
import gameService from './gameService'
import { ServiceStatus, UploadPreparationProgress, UploadStatus, UploadItem } from '@shared/types'
import { typedWebContentsSend } from '@shared/ipc-utils'
import SevenZip from 'node-7z'

// Enum for stages to track overall progress
enum UploadStage {
  Setup = 0,
  PullingApk = 1,
  AnalyzingObb = 2,
  PullingObb = 3,
  CreatingMetadata = 4,
  Compressing = 5,
  Uploading = 6,
  Complete = 7
}

class UploadService extends EventEmitter {
  private status: ServiceStatus = 'NOT_INITIALIZED'
  private uploadsBasePath: string
  private configFilePath: string
  private activeUpload: ReturnType<typeof execa> | null = null
  private activeCompression: SevenZip.ZipStream | null = null
  private isProcessing = false
  private uploadQueue: UploadItem[] = []

  constructor() {
    super()
    this.uploadsBasePath = join(app.getPath('userData'), 'uploads')
    this.configFilePath = join(app.getPath('userData'), 'rclone-upload.conf')
  }

  public async initialize(): Promise<ServiceStatus> {
    if (this.status === 'INITIALIZED') return 'INITIALIZED'

    console.log('Initializing UploadService...')

    try {
      await fs.mkdir(this.uploadsBasePath, { recursive: true })

      // Fetch and save rclone config for uploads
      await this.fetchRcloneConfig()

      this.status = 'INITIALIZED'
      console.log('UploadService initialized.')
      return 'INITIALIZED'
    } catch (error) {
      console.error('Failed to initialize UploadService:', error)
      this.status = 'ERROR'
      return 'ERROR'
    }
  }

  private async fetchRcloneConfig(): Promise<void> {
    const configUrl = 'https://vrpirates.wiki/downloads/vrp.upload.config' // TODO: Update URL when new upload endpoint is available

    try {
      console.log(`Fetching rclone upload config from: ${configUrl}`)
      const response = await fetch(configUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch rclone config: ${response.status} ${response.statusText}`)
      }

      const configData = await response.text()

      if (!configData.includes('[RSL-gameuploads]')) {
        throw new Error('Invalid rclone config: missing RSL-gameuploads section')
      }

      await fs.writeFile(this.configFilePath, configData, 'utf-8')
      console.log(`Rclone upload config saved to: ${this.configFilePath}`)
    } catch (error) {
      console.error('Error fetching rclone upload config:', error)
      throw error
    }
  }

  /**
   * Create a SHA256 hash from the device serial
   * This creates a unique but reproducible ID for the device
   */
  private generateHWID(deviceSerial: string): string {
    return crypto.createHash('sha256').update(deviceSerial).digest('hex')
  }

  private emitProgress(packageName: string, stage: string, progress: number): void {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow && !mainWindow.isDestroyed()) {
      const progressData: UploadPreparationProgress = {
        packageName,
        stage,
        progress
      }
      typedWebContentsSend.send(mainWindow, 'upload:progress', progressData)

      // Update queue item with progress info
      this.updateItemStatus(packageName, undefined, progress, stage)
    }
  }

  private updateProgress(packageName: string, stage: UploadStage, stageProgress: number): void {
    // Map stage to a descriptive name
    let stageName = 'Preparing upload'
    switch (stage) {
      case UploadStage.Setup:
        stageName = 'Setting up'
        break
      case UploadStage.PullingApk:
        stageName = 'Pulling APK'
        break
      case UploadStage.AnalyzingObb:
        stageName = 'Analyzing OBB content'
        break
      case UploadStage.PullingObb:
        stageName = 'Pulling OBB files'
        break
      case UploadStage.CreatingMetadata:
        stageName = 'Creating metadata'
        break
      case UploadStage.Compressing:
        stageName = 'Creating zip archive'
        break
      case UploadStage.Uploading:
        stageName = 'Uploading to server'
        break
      case UploadStage.Complete:
        stageName = 'Complete'
        break
    }

    this.emitProgress(packageName, stageName, stageProgress)
  }

  public getQueue(): UploadItem[] {
    return [...this.uploadQueue]
  }

  private findItemIndex(packageName: string): number {
    return this.uploadQueue.findIndex((item) => item.packageName === packageName)
  }

  private findItem(packageName: string): UploadItem | undefined {
    return this.uploadQueue.find((item) => item.packageName === packageName)
  }

  private updateItemStatus(
    packageName: string,
    status?: UploadStatus,
    progress?: number,
    stage?: string,
    error?: string,
    zipPath?: string
  ): void {
    const index = this.findItemIndex(packageName)
    if (index === -1) {
      console.warn(`[UploadService] Cannot update status for non-existent item: ${packageName}`)
      return
    }

    const updates: Partial<UploadItem> = {}
    if (status !== undefined) updates.status = status
    if (progress !== undefined) updates.progress = progress
    if (stage !== undefined) updates.stage = stage
    if (error !== undefined) updates.error = error
    if (zipPath !== undefined) updates.zipPath = zipPath

    this.uploadQueue[index] = { ...this.uploadQueue[index], ...updates }

    // Emit queue update
    this.emitQueueUpdated()
  }

  private emitQueueUpdated(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow && !mainWindow.isDestroyed()) {
      typedWebContentsSend.send(mainWindow, 'upload:queue-updated', this.uploadQueue)
    }
  }

  public addToQueue(
    packageName: string,
    gameName: string,
    versionCode: number,
    deviceId: string
  ): boolean {
    // Check if item is in the blacklist with this or lower version
    if (gameService.isGameBlacklisted(packageName, versionCode)) {
      console.log(
        `[UploadService] ${packageName} v${versionCode} is in the blacklist or has a newer version already uploaded.`
      )
      return false
    }

    // Check if item already exists in queue
    const existingItem = this.findItem(packageName)
    if (existingItem) {
      if (existingItem.status === 'Completed') {
        console.log(`[UploadService] ${packageName} already uploaded successfully.`)
        return false
      } else if (existingItem.status !== 'Error' && existingItem.status !== 'Cancelled') {
        console.log(
          `[UploadService] ${packageName} is already in the queue with status: ${existingItem.status}`
        )
        return false
      }

      // Remove previous item if it was in error or cancelled
      this.uploadQueue = this.uploadQueue.filter((item) => item.packageName !== packageName)
    }

    // Add new item to queue
    const newItem: UploadItem = {
      packageName,
      gameName,
      versionCode,
      deviceId,
      status: 'Queued',
      progress: 0,
      addedDate: Date.now()
    }

    this.uploadQueue.push(newItem)
    console.log(`[UploadService] Added ${packageName} v${versionCode} to upload queue.`)
    this.emitQueueUpdated()

    // Start processing the queue if we're not already
    if (!this.isProcessing) {
      this.processQueue()
    }

    return true
  }

  public removeFromQueue(packageName: string): void {
    const item = this.findItem(packageName)
    if (!item) return

    if (item.status === 'Preparing' || item.status === 'Uploading') {
      // Item is active, cancel it first
      this.cancelUpload(packageName)
    }

    this.uploadQueue = this.uploadQueue.filter((item) => item.packageName !== packageName)
    this.emitQueueUpdated()
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return

    // Find next queued item
    const nextItem = this.uploadQueue.find((item) => item.status === 'Queued')
    if (!nextItem) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true
    console.log(`[UploadService] Processing next upload: ${nextItem.packageName}`)

    try {
      // Update status to Preparing
      this.updateItemStatus(nextItem.packageName, 'Preparing')

      // Start the upload process
      const zipPath = await this.prepareUpload(
        nextItem.packageName,
        nextItem.gameName,
        nextItem.versionCode,
        nextItem.deviceId
      )

      if (zipPath) {
        console.log(`[UploadService] Upload completed successfully for ${nextItem.packageName}`)
        this.updateItemStatus(
          nextItem.packageName,
          'Completed',
          100,
          'Complete',
          undefined,
          zipPath
        )

        // Add to blacklist when successfully uploaded, with specific version
        await gameService.addToBlacklist(nextItem.packageName, nextItem.versionCode)
      } else {
        console.error(`[UploadService] Upload failed for ${nextItem.packageName}`)
        this.updateItemStatus(nextItem.packageName, 'Error', 0, 'Error', 'Upload failed')
      }
    } catch (error) {
      console.error(`[UploadService] Error processing upload for ${nextItem.packageName}:`, error)
      this.updateItemStatus(
        nextItem.packageName,
        'Error',
        0,
        'Error',
        error instanceof Error ? error.message : 'Unknown error'
      )
    } finally {
      this.isProcessing = false
      this.processQueue() // Process next item in queue
    }
  }

  public async prepareUpload(
    packageName: string,
    gameName: string,
    versionCode: number,
    deviceId: string
  ): Promise<string | null> {
    if (this.status !== 'INITIALIZED') {
      throw new Error('UploadService is not initialized')
    }

    try {
      // --- SETUP STAGE ---
      this.updateProgress(packageName, UploadStage.Setup, 0)

      // Get device info
      const devicesList = await adbService.listDevices()
      const deviceInfo = devicesList.find((d) => d.id === deviceId)

      if (!deviceInfo) {
        throw new Error(`Device with ID ${deviceId} not found or not connected`)
      }

      // Use model as device codename
      const deviceCodename = deviceInfo.model || 'unknown'

      // Generate HWID
      const hwid = this.generateHWID(deviceId)
      const hwidPrefix = hwid.substring(0, 1)

      // Create folder path for the app
      const packageFolderName = packageName
      const packageFolderPath = join(this.uploadsBasePath, packageFolderName)

      // Clean up any existing folder
      if (existsSync(packageFolderPath)) {
        await fs.rm(packageFolderPath, { recursive: true, force: true })
      }

      // Create the app folder
      await fs.mkdir(packageFolderPath, { recursive: true })
      this.updateProgress(packageName, UploadStage.Setup, 100)

      // --- PULLING APK STAGE ---
      this.updateProgress(packageName, UploadStage.PullingApk, 0)

      // Get the path to the APK on the device
      const shellCmd = `pm path ${packageName}`
      const apkPathOutput = await adbService.runShellCommand(deviceId, shellCmd)

      if (!apkPathOutput || !apkPathOutput.includes('package:')) {
        throw new Error(`Could not find APK for ${packageName} on device`)
      }

      // Extract the APK path from the output
      const apkPath = apkPathOutput.trim().split('\n')[0].replace('package:', '')
      const apkFileName = `${packageName}.apk`
      const localApkPath = join(packageFolderPath, apkFileName)

      // Pull the APK file
      this.updateProgress(packageName, UploadStage.PullingApk, 50)
      console.log(`Pulling APK from ${apkPath} to ${localApkPath}...`)
      await adbService.pullFile(deviceId, apkPath, localApkPath)
      this.updateProgress(packageName, UploadStage.PullingApk, 100)

      // --- ANALYZING OBB STAGE ---
      this.updateProgress(packageName, UploadStage.AnalyzingObb, 0)

      // Check if OBB folder exists
      const obbFolderPath = `/sdcard/Android/obb/${packageName}`
      const obbCheckCmd = `[ -d "${obbFolderPath}" ] && echo "EXISTS" || echo ""`
      const obbExists = await adbService.runShellCommand(deviceId, obbCheckCmd)
      this.updateProgress(packageName, UploadStage.AnalyzingObb, 50)

      // --- PULLING OBB STAGE ---
      this.updateProgress(packageName, UploadStage.PullingObb, 0)

      // Pull OBB folder if it exists
      if (obbExists && obbExists.includes('EXISTS')) {
        console.log(`OBB folder found for ${packageName}, analyzing contents...`)

        // Create the main OBB folder locally
        const localObbFolder = join(packageFolderPath, packageFolderName)
        await fs.mkdir(localObbFolder, { recursive: true })

        // List all files in the OBB folder recursively with their sizes
        const listFilesCmd = `find "${obbFolderPath}" -type f -printf "%s %p\\n"`
        const filesListOutput = await adbService.runShellCommand(deviceId, listFilesCmd)
        this.updateProgress(packageName, UploadStage.AnalyzingObb, 100)

        if (!filesListOutput || !filesListOutput.trim()) {
          console.log(`No files found in OBB folder for ${packageName}`)
          this.updateProgress(packageName, UploadStage.PullingObb, 100)
        } else {
          // Parse the output to get files with their sizes
          const fileEntries = filesListOutput
            .trim()
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => {
              const match = line.match(/^(\d+)\s+(.+)$/)
              if (match) {
                return {
                  size: parseInt(match[1], 10),
                  path: match[2]
                }
              }
              return null
            })
            .filter((entry) => entry !== null) as { size: number; path: string }[]

          const totalSize = fileEntries.reduce((sum, entry) => sum + entry.size, 0)
          let downloadedSize = 0

          console.log(
            `Found ${fileEntries.length} files in OBB folder, total size: ${totalSize} bytes`
          )

          // Pull each file one by one, maintaining directory structure
          for (let i = 0; i < fileEntries.length; i++) {
            const { path: remotePath, size } = fileEntries[i]

            // Create relative path from OBB folder root
            const relPath = remotePath.substring(obbFolderPath.length + 1) // +1 for the slash
            const localPath = join(localObbFolder, relPath)

            // Ensure parent directory exists
            const parentDir = dirname(localPath)
            await fs.mkdir(parentDir, { recursive: true })

            console.log(
              `Pulling file ${i + 1}/${fileEntries.length}: ${remotePath} (${size} bytes)`
            )
            await adbService.pullFile(deviceId, remotePath, localPath)

            // Update progress
            downloadedSize += size
            const progressPercentage = Math.min(Math.floor((downloadedSize / totalSize) * 100), 100)
            this.updateProgress(packageName, UploadStage.PullingObb, progressPercentage)
          }

          console.log(`Successfully pulled all OBB files for ${packageName}`)
        }
      } else {
        console.log(`No OBB folder found for ${packageName}`)
        this.updateProgress(packageName, UploadStage.PullingObb, 100)
      }

      // --- CREATING METADATA STAGE ---
      this.updateProgress(packageName, UploadStage.CreatingMetadata, 0)

      // Create HWID.txt file
      await fs.writeFile(join(packageFolderPath, 'HWID.txt'), hwid, 'utf-8')
      this.updateProgress(packageName, UploadStage.CreatingMetadata, 100)

      // --- COMPRESSING STAGE ---
      this.updateProgress(packageName, UploadStage.Compressing, 0)

      // Create the zip file
      const zipFileName = `${gameName} v${versionCode} ${packageName} ${hwidPrefix} ${deviceCodename}.zip`
      const zipFilePath = join(this.uploadsBasePath, zipFileName)

      // Delete existing zip file if it exists
      if (existsSync(zipFilePath)) {
        await fs.unlink(zipFilePath)
      }

      // Compress the folder using 7zip
      const sevenZipPath = dependencyService.get7zPath()
      if (!sevenZipPath) {
        throw new Error('7zip not found. Cannot create zip archive.')
      }

      console.log(`Creating zip archive at ${zipFilePath}...`)

      await new Promise<void>((resolve, reject) => {
        const myStream = SevenZip.add(zipFilePath, `${packageFolderPath}/*`, {
          $bin: sevenZipPath,
          $progress: true
        })

        if (!myStream) {
          throw new Error('Failed to start 7zip compression process.')
        }

        // Store the compression stream for cancellation
        this.activeCompression = myStream

        // Set up progress tracking
        let lastProgress = 0

        myStream.on('progress', (progress) => {
          if (progress.percent > lastProgress) {
            lastProgress = progress.percent
            console.log(`[Compression progress]: ${progress.percent}%`)
            this.updateProgress(packageName, UploadStage.Compressing, progress.percent)
          }
        })

        myStream.on('end', () => {
          console.log(`[Compression complete]: ${zipFilePath}`)
          this.activeCompression = null
          resolve()
        })

        myStream.on('error', (error) => {
          console.error(`[Compression error]: ${error}`)
          this.activeCompression = null
          reject(error)
        })
      })

      this.updateProgress(packageName, UploadStage.Compressing, 100)

      await fs.rm(packageFolderPath, { recursive: true, force: true })

      // --- UPLOADING STAGE ---
      this.updateProgress(packageName, UploadStage.Uploading, 0)

      // Check if the generated zip file exists
      if (!existsSync(zipFilePath)) {
        throw new Error(`Zip file not found: ${zipFilePath}`)
      }

      try {
        // Update item status for upload stage
        this.updateItemStatus(packageName, 'Uploading', 0, 'Uploading to server')

        // Upload the zip file to the server
        const uploadSuccess = await this.uploadToServer(packageName, zipFilePath)

        if (!uploadSuccess) {
          throw new Error('Failed to upload to server')
        }

        this.updateProgress(packageName, UploadStage.Uploading, 100)
      } catch (uploadError) {
        console.error(`Error uploading ${zipFilePath} to server:`, uploadError)
        throw uploadError
      }

      // --- COMPLETE STAGE ---
      this.updateProgress(packageName, UploadStage.Complete, 100)
      console.log(`Upload completed: ${zipFilePath}`)

      return zipFilePath
    } catch (error) {
      console.error(`Error preparing upload for ${packageName}:`, error)
      this.emitProgress(packageName, 'Error', 0)
      return null
    }
  }

  /**
   * Uploads the zip file to the server using rclone
   * @param packageName The package name
   * @param zipFilePath Path to the zip file to upload
   * @returns true if upload was successful, false otherwise
   */
  private async uploadToServer(packageName: string, zipFilePath: string): Promise<boolean> {
    console.log(`[UploadService] Starting upload of ${zipFilePath} to server`)

    if (!existsSync(this.configFilePath)) {
      console.error(`[UploadService] Rclone config file not found: ${this.configFilePath}`)
      throw new Error('Rclone config file not found')
    }

    const rclonePath = dependencyService.getRclonePath()
    if (!rclonePath) {
      console.error('[UploadService] Rclone path not found.')
      throw new Error('Rclone dependency not found')
    }

    try {
      // Now upload the actual zip file with progress tracking
      console.log(`[UploadService] Starting upload of zip file: ${zipFilePath}`)

      this.activeUpload = execa(
        rclonePath,
        [
          'copy',
          zipFilePath,
          'RSL-gameuploads:',
          '--config',
          this.configFilePath,
          '--checkers',
          '1',
          '--retries',
          '2',
          '--inplace',
          '--progress',
          '--stats',
          '1s',
          '--stats-one-line'
        ],
        {
          all: true,
          buffer: false,
          windowsHide: true
        }
      )

      if (!this.activeUpload || !this.activeUpload.all) {
        throw new Error('Failed to start rclone upload process')
      }

      // Parse progress from rclone output
      const transferRegex = /(\d+)%/

      this.activeUpload.all.on('data', (data: Buffer) => {
        const output = data.toString()
        console.log(`[Upload Output] ${output}`)

        // Look for percentage in the output
        const lines = output.split('\n')
        for (const line of lines) {
          const matches = line.match(transferRegex)
          if (matches && matches[1]) {
            const progress = parseInt(matches[1], 10)
            if (!isNaN(progress)) {
              this.updateProgress(packageName, UploadStage.Uploading, progress)
            }
          }
        }
      })

      // Wait for the upload to complete
      await this.activeUpload

      console.log(`[UploadService] Zip file uploaded successfully`)

      // Clean up

      try {
        await fs.unlink(zipFilePath)
      } catch (error) {
        console.warn(`[UploadService] Failed to delete zip file: ${zipFilePath}`, error)
      }

      this.activeUpload = null
      return true
    } catch (error) {
      console.error(`[UploadService] Error uploading to server:`, error)
      if (this.activeUpload) {
        try {
          this.activeUpload.kill('SIGTERM')
        } catch (killError) {
          console.warn(`[UploadService] Error killing active upload:`, killError)
        }
        this.activeUpload = null
      }
      throw error
    }
  }

  public cancelUpload(packageName: string): void {
    let cancelled = false

    // Cancel active compression if running
    if (this.activeCompression) {
      console.log(`[UploadService] Cancelling active compression`)
      try {
        this.activeCompression.destroy()
        this.activeCompression = null
        cancelled = true
      } catch (error) {
        console.error(`[UploadService] Error cancelling compression:`, error)
      }
    }

    // Cancel active upload if running
    if (this.activeUpload) {
      console.log(`[UploadService] Cancelling active upload`)
      try {
        this.activeUpload.kill('SIGTERM')
        this.activeUpload = null
        cancelled = true
      } catch (error) {
        console.error(`[UploadService] Error cancelling upload:`, error)
      }
    }

    if (cancelled) {
      this.emitProgress(packageName, 'Cancelled', 0)
      this.updateItemStatus(packageName, 'Cancelled', 0, 'Cancelled')
    } else {
      console.log(`[UploadService] No active upload or compression to cancel`)
    }
  }
}

export default new UploadService()
