import { useState, useCallback } from 'react'

export const useLogs = (): {
  isUploading: boolean
  uploadError: string | null
  uploadSuccess: boolean
  shareableUrl: string | null
  password: string | null
  slug: string | null
  uploadCurrentLog: () => Promise<void>
  clearUploadState: () => void
  openLogFolder: () => Promise<void>
  openLogFile: () => Promise<void>
} => {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [shareableUrl, setShareableUrl] = useState<string | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)

  const uploadCurrentLog = useCallback(async (): Promise<void> => {
    try {
      setIsUploading(true)
      setUploadError(null)
      setUploadSuccess(false)
      setShareableUrl(null)
      setPassword(null)
      setSlug(null)

      const result = await window.api.logs.uploadCurrentLog()

      if (result) {
        setShareableUrl(result.url)
        setPassword(result.password)
        setSlug(result.slug)
        setUploadSuccess(true)
        // Auto-copy the entry code to clipboard so the user can paste it immediately
        if (result.slug) {
          try {
            await navigator.clipboard.writeText(result.slug)
          } catch {
            // Silently ignore clipboard errors
          }
        }
      } else {
        setUploadError('Failed to upload log file. Please try again.')
      }
    } catch (error) {
      console.error('Error uploading log file:', error)
      setUploadError('Failed to upload log file. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }, [])

  const clearUploadState = useCallback(() => {
    setUploadError(null)
    setUploadSuccess(false)
    setShareableUrl(null)
    setPassword(null)
    setSlug(null)
  }, [])

  const openLogFolder = useCallback(async (): Promise<void> => {
    await window.api.logs.openLogFolder()
  }, [])

  const openLogFile = useCallback(async (): Promise<void> => {
    await window.api.logs.openLogFile()
  }, [])

  return {
    isUploading,
    uploadError,
    uploadSuccess,
    shareableUrl,
    password,
    slug,
    uploadCurrentLog,
    clearUploadState,
    openLogFolder,
    openLogFile
  }
}
