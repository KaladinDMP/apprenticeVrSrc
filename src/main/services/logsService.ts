import { app, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { LogsAPI } from '@shared/types'

const MAX_LOG_BYTES = 150 * 1024 // 150 KB cap for rentry.co

class LogsService implements LogsAPI {
  public getLogFilePath(): string {
    return join(app.getPath('userData'), 'logs', 'main.log')
  }

  public getLogFolderPath(): string {
    return join(app.getPath('userData'), 'logs')
  }

  public async openLogFolder(): Promise<void> {
    const folderPath = this.getLogFolderPath()
    console.log('[LogsService] Opening log folder:', folderPath)
    await shell.openPath(folderPath)
  }

  public async openLogFile(): Promise<void> {
    const filePath = this.getLogFilePath()
    console.log('[LogsService] Opening log file:', filePath)
    if (existsSync(filePath)) {
      await shell.openPath(filePath)
    } else {
      console.warn('[LogsService] Log file not found:', filePath)
    }
  }

  async uploadCurrentLog(): Promise<{ url: string; password: string; slug: string } | null> {
    const logFilePath = this.getLogFilePath()

    if (!existsSync(logFilePath)) {
      console.error('[LogsService] Log file not found at:', logFilePath)
      return null
    }

    try {
      console.log('[LogsService] Reading log file...')
      const raw = readFileSync(logFilePath, 'utf-8')

      // Truncate to last MAX_LOG_BYTES if the file is too large
      const content =
        Buffer.byteLength(raw, 'utf-8') > MAX_LOG_BYTES
          ? `[...truncated — showing last ~150 KB...]\n\n${raw.slice(-MAX_LOG_BYTES)}`
          : raw

      console.log('[LogsService] Uploading log to rentry.co...')

      // Step 1: Retrieve CSRF token from rentry.co
      const initResponse = await fetch('https://rentry.co/', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      const setCookieHeader = initResponse.headers.get('set-cookie')
      const csrfMatch = setCookieHeader?.match(/csrftoken=([^;,\s]+)/)
      if (!csrfMatch) {
        throw new Error('Could not retrieve CSRF token from rentry.co')
      }
      const csrfToken = csrfMatch[1]

      // Step 2: POST log content to rentry.co API
      const formData = new URLSearchParams()
      formData.append('csrfmiddlewaretoken', csrfToken)
      formData.append('text', content)

      const postResponse = await fetch('https://rentry.co/api/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `csrftoken=${csrfToken}`,
          Referer: 'https://rentry.co/'
        },
        body: formData.toString()
      })

      if (!postResponse.ok) {
        throw new Error(`Rentry API HTTP error: ${postResponse.status} ${postResponse.statusText}`)
      }

      const result = (await postResponse.json()) as {
        status: string
        url: string
        edit_code: string
      }

      if (result.status !== '200') {
        throw new Error(`Rentry API returned status ${result.status}`)
      }

      const entryUrl = result.url
      // Strip protocol + domain to get just the slug (e.g. "abc12345")
      const slug = entryUrl.replace(/^https?:\/\/rentry\.co\//, '')

      console.log('[LogsService] Log uploaded successfully:', entryUrl, '(slug:', slug + ')')
      return { url: entryUrl, password: '', slug }
    } catch (error) {
      console.error('[LogsService] Failed to upload log to rentry.co:', error)
      return null
    }
  }
}

export default new LogsService()
