import React, { useEffect, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Text,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import { SendRegular } from '@fluentui/react-icons'

interface HistoryEntry {
  command: string
  output: string | null
  error?: boolean
}

interface AdbShellDialogProps {
  deviceId: string
  isOpen: boolean
  onDismiss: () => void
}

const useStyles = makeStyles({
  terminal: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: "'Consolas', 'Courier New', monospace",
    fontSize: '13px',
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    overflowY: 'auto',
    height: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  prompt: {
    color: '#4ec9b0',
    userSelect: 'none'
  },
  commandText: {
    color: '#9cdcfe'
  },
  outputText: {
    color: '#d4d4d4',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all'
  },
  errorText: {
    color: '#f48771',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all'
  },
  emptyHint: {
    color: '#6a9955',
    fontStyle: 'italic'
  },
  inputRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    marginTop: tokens.spacingVerticalS
  }
})

export function AdbShellDialog({ deviceId, isOpen, onDismiss }: AdbShellDialogProps): React.ReactElement {
  const styles = useStyles()
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setHistory([])
      setCommand('')
      setHistoryIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const runCommand = async (): Promise<void> => {
    const cmd = command.trim()
    if (!cmd || isRunning) return

    setIsRunning(true)
    setCommand('')
    setHistoryIndex(-1)

    let output: string | null = null
    let isError = false

    try {
      output = await window.api.adb.runShellCommand(deviceId, cmd)
      if (output === null) {
        output = '(no output)'
      }
    } catch (err) {
      output = err instanceof Error ? err.message : String(err)
      isError = true
    }

    setHistory((prev) => [...prev, { command: cmd, output, error: isError }])
    setIsRunning(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      runCommand()
      return
    }

    const cmds = history.map((h) => h.command)
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = historyIndex + 1
      if (nextIndex < cmds.length) {
        setHistoryIndex(nextIndex)
        setCommand(cmds[cmds.length - 1 - nextIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex <= 0) {
        setHistoryIndex(-1)
        setCommand('')
      } else {
        const nextIndex = historyIndex - 1
        setHistoryIndex(nextIndex)
        setCommand(cmds[cmds.length - 1 - nextIndex])
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(_, { open }) => { if (!open) onDismiss() }}>
      <DialogSurface style={{ minWidth: '680px', maxWidth: '900px' }}>
        <DialogBody>
          <DialogTitle>ADB Shell — {deviceId}</DialogTitle>

          <DialogContent>
            <div ref={terminalRef} className={styles.terminal} onClick={() => inputRef.current?.focus()}>
              {history.length === 0 && (
                <span className={styles.emptyHint}>Type a shell command and press Enter.</span>
              )}
              {history.map((entry, i) => (
                <div key={i}>
                  <div>
                    <span className={styles.prompt}>$ </span>
                    <span className={styles.commandText}>{entry.command}</span>
                  </div>
                  {entry.output !== null && (
                    <div className={entry.error ? styles.errorText : styles.outputText}>
                      {entry.output}
                    </div>
                  )}
                </div>
              ))}
              {isRunning && (
                <div>
                  <span className={styles.prompt}>$ </span>
                  <span className={styles.commandText}>{command}</span>
                  <span style={{ color: '#6a9955' }}> ...</span>
                </div>
              )}
            </div>

            <div className={styles.inputRow}>
              <Text style={{ color: tokens.colorBrandForeground1, fontFamily: 'monospace' }}>$</Text>
              <Input
                ref={inputRef}
                value={command}
                onChange={(_, data) => setCommand(data.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter shell command..."
                style={{ flex: 1, fontFamily: 'monospace' }}
                disabled={isRunning}
              />
              <Button
                icon={<SendRegular />}
                appearance="primary"
                onClick={runCommand}
                disabled={!command.trim() || isRunning}
              >
                Run
              </Button>
            </div>
          </DialogContent>

          <DialogActions>
            <Button appearance="secondary" onClick={() => setHistory([])}>
              Clear
            </Button>
            <Button appearance="secondary" onClick={onDismiss}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
