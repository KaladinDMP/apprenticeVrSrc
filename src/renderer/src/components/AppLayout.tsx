import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AdbProvider } from '../context/AdbProvider'
import { GamesProvider } from '../context/GamesProvider'
import DeviceList from './DeviceList'
import GamesView from './GamesView'
import DownloadsView from './DownloadsView'
import UploadsView from './UploadsView'
import Settings from './Settings'
import { UpdateNotification } from './UpdateNotification'
import UploadGamesDialog from './UploadGamesDialog'
import {
  FluentProvider,
  makeStyles,
  tokens,
  Spinner,
  Text,
  teamsDarkTheme,
  teamsLightTheme,
  Switch,
  Button,
  Drawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  TabList,
  Tab
} from '@fluentui/react-components'
import electronLogo from '../assets/icon.svg'
import { useDependency } from '../hooks/useDependency'
import { DependencyProvider } from '../context/DependencyProvider'
import { DownloadProvider } from '../context/DownloadProvider'
import { SettingsProvider } from '../context/SettingsProvider'
import { useDownload } from '../hooks/useDownload'
import {
  ArrowDownloadRegular as DownloadIcon,
  DismissRegular as CloseIcon,
  DesktopRegular,
  SettingsRegular,
  ArrowUploadRegular as UploadIcon
} from '@fluentui/react-icons'
import { UploadProvider } from '@renderer/context/UploadProvider'
import { useUpload } from '@renderer/hooks/useUpload'
import { GameDialogProvider } from '@renderer/context/GameDialogProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { LanguageProvider } from '@renderer/context/LanguageProvider'
import { useLanguage } from '@renderer/hooks/useLanguage'
import LocalUploadDialog from './LocalUploadDialog'
import CreditsDialog from './CreditsDialog'
import '../assets/credits-dialog.css'

enum AppView {
  DEVICE_LIST,
  GAMES
}

// Type for app tab navigation
type ActiveTab = 'games' | 'settings'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalNone} ${tokens.spacingHorizontalL}`,
    borderBottom: '1px solid rgba(0, 212, 255, 0.35)',
    backgroundColor: '#050514',
    backgroundImage:
      'linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    boxShadow: '0 1px 24px 0 rgba(0, 212, 255, 0.08), inset 0 -1px 0 rgba(176, 64, 255, 0.15)',
    gap: tokens.spacingHorizontalM,
    justifyContent: 'space-between',
    height: '90px',
    flexShrink: 0
  },
  logo: {
    height: '52px',
    filter:
      'drop-shadow(0 0 6px #00d4ff) drop-shadow(0 0 14px rgba(176, 64, 255, 0.7))'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM
  },
  titleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px'
  },
  titleMain: {
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '0.04em',
    background: 'linear-gradient(100deg, #00d4ff 0%, #c060ff 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    lineHeight: '1.2',
    textShadow: 'none'
  },
  titleSub: {
    fontSize: '10px',
    letterSpacing: '0.18em',
    fontFamily: 'monospace',
    color: 'rgba(0, 212, 255, 0.55)',
    lineHeight: '1.2'
  },
  titleCredit: {
    fontSize: '9px',
    letterSpacing: '0.14em',
    fontFamily: 'monospace',
    color: 'rgba(176, 64, 255, 0.5)',
    lineHeight: '1.2',
    display: 'flex',
    alignItems: 'center'
  },
  mainContent: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: 'calc(100vh - 90px)', // Remaining height after header
    position: 'relative'
  },
  loadingOrErrorContainer: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalL
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM
  },
  tabs: {
    marginLeft: tokens.spacingHorizontalM,
    marginRight: tokens.spacingHorizontalM
  }
})

interface MainContentProps {
  currentView: AppView
  activeTab: ActiveTab
  onDeviceConnected: () => void
  onSkipConnection: () => void
  onBackToDeviceList: () => void
}

const MainContent: React.FC<MainContentProps> = ({
  currentView,
  activeTab,
  onDeviceConnected,
  onSkipConnection,
  onBackToDeviceList
}) => {
  const styles = useStyles()
  const {
    isReady: dependenciesReady,
    error: dependencyError,
    progress: dependencyProgress,
    status: dependencyStatus
  } = useDependency()

  const renderCurrentView = (): React.ReactNode => {
    if (currentView === AppView.DEVICE_LIST) {
      return <DeviceList onConnected={onDeviceConnected} onSkip={onSkipConnection} />
    }

    // Return the appropriate content based on active tab
    if (activeTab === 'settings') {
      return <Settings />
    } else {
      return <GamesView onBackToDevices={onBackToDeviceList} />
    }
  }

  if (!dependenciesReady) {
    if (dependencyError) {
      // Check if this is a connectivity error
      if (dependencyError.startsWith('CONNECTIVITY_ERROR|')) {
        const failedUrls = dependencyError.replace('CONNECTIVITY_ERROR|', '').split('|')

        return (
          <div className={styles.loadingOrErrorContainer}>
            <Text weight="semibold" style={{ color: tokens.colorPaletteRedForeground1 }}>
              Network Connectivity Issues
            </Text>
            <Text>Cannot reach the following services:</Text>
            <ul style={{ textAlign: 'left', marginTop: tokens.spacingVerticalS }}>
              {failedUrls.map((url, index) => (
                <li key={index} style={{ marginBottom: tokens.spacingVerticalXS }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>{url}</Text>
                </li>
              ))}
            </ul>
            <Text style={{ marginTop: tokens.spacingVerticalM }}>
              This is likely due to DNS or firewall restrictions. Please try:
            </Text>
            <ol style={{ textAlign: 'left', marginTop: tokens.spacingVerticalS }}>
              <li style={{ marginBottom: tokens.spacingVerticalXS }}>
                <Text>Change your DNS to Cloudflare (1.1.1.1) or Google (8.8.8.8)</Text>
              </li>
              <li style={{ marginBottom: tokens.spacingVerticalXS }}>
                <Text>Use a VPN like ProtonVPN or 1.1.1.1 VPN</Text>
              </li>
              <li style={{ marginBottom: tokens.spacingVerticalXS }}>
                <Text>Check your router/firewall settings</Text>
              </li>
            </ol>
            <Text style={{ marginTop: tokens.spacingVerticalM }}>
              For detailed troubleshooting, see:{' '}
              <a
                href="https://github.com/jimzrt/apprenticeVr#troubleshooting-guide"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: tokens.colorBrandForeground1 }}
              >
                Troubleshooting Guide
              </a>
            </Text>
          </div>
        )
      }

      // Handle other dependency errors
      const errorDetails: string[] = []
      if (!dependencyStatus?.sevenZip.ready) errorDetails.push('7zip')
      if (!dependencyStatus?.rclone.ready) errorDetails.push('rclone')
      if (!dependencyStatus?.adb.ready) errorDetails.push('adb')

      const failedDeps = errorDetails.length > 0 ? ` (${errorDetails.join(', ')})` : ''

      return (
        <div className={styles.loadingOrErrorContainer}>
          <Text weight="semibold" style={{ color: tokens.colorPaletteRedForeground1 }}>
            Dependency Error {failedDeps}
          </Text>
          <Text>{dependencyError}</Text>
        </div>
      )
    }
    let progressText = 'Checking requirements...'
    console.log('dependencyStatus', dependencyStatus)
    console.log('dependencyProgress', dependencyProgress)

    if (dependencyProgress?.name === 'connectivity-check') {
      progressText = `Checking network connectivity... ${dependencyProgress.percentage}%`
    } else if (dependencyStatus?.rclone.downloading && dependencyProgress) {
      progressText = `Setting up ${dependencyProgress.name}... ${dependencyProgress.percentage}%`
      if (dependencyProgress.name === 'rclone-extract') {
        progressText = `Extracting ${dependencyProgress.name.replace('-extract', '')}...`
      }
    } else if (dependencyStatus?.adb.downloading && dependencyProgress) {
      progressText = `Setting up ${dependencyProgress.name}... ${dependencyProgress.percentage}%`
      if (dependencyProgress.name === 'adb-extract') {
        progressText = `Extracting ${dependencyProgress.name.replace('-extract', '')}...`
      }
    } else if (
      dependencyStatus &&
      (!dependencyStatus.sevenZip.ready ||
        !dependencyStatus.rclone.ready ||
        !dependencyStatus.adb.ready)
    ) {
      progressText = 'Setting up requirements...'
    }

    return (
      <div className={styles.loadingOrErrorContainer}>
        <Spinner size="huge" />
        <Text>{progressText}</Text>
      </div>
    )
  }

  return (
    <>
      <UploadGamesDialog />
      {renderCurrentView()}
    </>
  )
}

const AppLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DEVICE_LIST)
  const [activeTab, setActiveTab] = useState<ActiveTab>('games')
  const { colorScheme, setColorScheme } = useSettings()
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false)
  const [isUploadsOpen, setIsUploadsOpen] = useState(false)
  const [isCreditsOpen, setIsCreditsOpen] = useState(false)
  const mountNodeRef = useRef<HTMLDivElement>(null)
  const styles = useStyles()
  const { queue: downloadQueue } = useDownload()
  const { queue: uploadQueue } = useUpload()
  const { t } = useLanguage()

  const handleDeviceConnected = (): void => {
    setCurrentView(AppView.GAMES)
  }

  const handleSkipConnection = (): void => {
    setCurrentView(AppView.GAMES)
  }

  const handleBackToDeviceList = (): void => {
    setCurrentView(AppView.DEVICE_LIST)
  }

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent): void => {
      setColorScheme(e.matches ? 'dark' : 'light')
    }

    darkModeMediaQuery.addEventListener('change', handleChange)

    return () => {
      darkModeMediaQuery.removeEventListener('change', handleChange)
    }
  }, [setColorScheme])

  const currentTheme = colorScheme === 'dark' ? teamsDarkTheme : teamsLightTheme

  const handleThemeChange = (_ev, data: { checked: boolean }): void => {
    setColorScheme(data.checked ? 'dark' : 'light')
  }

  const downloadQueueProgress = useMemo(() => {
    const activeDownloads = downloadQueue.filter((item) => item.status === 'Downloading')
    const extractingDownloads = downloadQueue.filter((item) => item.status === 'Extracting')
    const installingDownloads = downloadQueue.filter((item) => item.status === 'Installing')
    const queuedDownloads = downloadQueue.filter((item) => item.status === 'Queued')
    return {
      activeDownloads,
      extractingDownloads,
      installingDownloads,
      queuedDownloads
    }
  }, [downloadQueue])

  const uploadQueueProgress = useMemo(() => {
    const preparingUploads = uploadQueue.filter((item) => item.status === 'Preparing')
    const activeUploads = uploadQueue.filter((item) => item.status === 'Uploading')
    const queuedUploads = uploadQueue.filter((item) => item.status === 'Queued')
    return {
      preparingUploads,
      activeUploads,
      queuedUploads
    }
  }, [uploadQueue])

  const getDownloadButtonContent = (): { icon: React.ReactNode; text: string } => {
    const { activeDownloads, extractingDownloads, installingDownloads, queuedDownloads } =
      downloadQueueProgress

    if (activeDownloads.length > 0) {
      const activeDownload = activeDownloads[0]
      const activeDownloadProgress = activeDownload.progress
      const activeDownloadEta = activeDownload.eta || ''
      const activeDownloadSpeed = activeDownload.speed || ''
      let text = `${activeDownload.gameName} (${activeDownloadProgress}%) ${activeDownloadEta} ${activeDownloadSpeed}`
      if (queuedDownloads.length > 0) text += ` (+${queuedDownloads.length})`
      return { icon: <Spinner size="tiny" style={{ animationDuration: '1s' }} />, text }
    } else if (extractingDownloads.length > 0) {
      const d = extractingDownloads[0]
      let text = `${t('extracting')} ${d.gameName} (${d.extractProgress || 0}%)...`
      if (queuedDownloads.length > 0) text += ` (+${queuedDownloads.length})`
      return { icon: <Spinner size="tiny" style={{ animationDuration: '1s' }} />, text }
    } else if (installingDownloads.length > 0) {
      const d = installingDownloads[0]
      let text = `${t('installing')} ${d.gameName}...`
      if (queuedDownloads.length > 0) text += ` (+${queuedDownloads.length})`
      return { icon: <Spinner size="tiny" style={{ animationDuration: '1s' }} />, text }
    } else {
      return { icon: <DownloadIcon />, text: t('downloads') }
    }
  }

  const getUploadButtonContent = (): { icon: React.ReactNode; text: string } => {
    const { preparingUploads, activeUploads, queuedUploads } = uploadQueueProgress

    if (activeUploads.length > 0) {
      const u = activeUploads[0]
      let text = `${t('uploading')} ${u.gameName} (${u.progress}%)`
      if (queuedUploads.length > 0) text += ` (+${queuedUploads.length})`
      return { icon: <Spinner size="tiny" style={{ animationDuration: '1s' }} />, text }
    } else if (preparingUploads.length > 0) {
      const u = preparingUploads[0]
      let text = `${u.stage || 'Preparing'} ${u.gameName} (${u.progress}%)`
      if (queuedUploads.length > 0) text += ` (+${queuedUploads.length})`
      return { icon: <Spinner size="tiny" style={{ animationDuration: '1s' }} />, text }
    } else if (queuedUploads.length > 0) {
      return { icon: <UploadIcon />, text: `${t('uploads')} (${queuedUploads.length})` }
    } else {
      return { icon: <UploadIcon />, text: t('uploads') }
    }
  }

  const { icon: downloadButtonIcon, text: downloadButtonText } = getDownloadButtonContent()
  const { icon: uploadButtonIcon, text: uploadButtonText } = getUploadButtonContent()

  return (
    <FluentProvider theme={currentTheme}>
      <AdbProvider>
        <GamesProvider>
          <GameDialogProvider>
            <div className={styles.root}>
              <div className={styles.header}>
                <div className={styles.headerContent}>
                  <img alt="logo" className={styles.logo} src={electronLogo} />
                  <div className={styles.titleSection}>
                    <span className={styles.titleMain}>Apprentice VR</span>
                    <span className={styles.titleSub}>アプレンティスVR · VR SRC EDITION</span>
                    <span className={styles.titleCredit}>
                      MADE WITH ♥ BY DMP OF ARMGDDN GAMES
                      <button
                        className="credits-question-btn"
                        onClick={() => setIsCreditsOpen(true)}
                        title="Credits"
                      >
                        ?
                      </button>
                    </span>
                  </div>
                </div>
                <div className={styles.headerActions}>
                  {currentView !== AppView.DEVICE_LIST && (
                    <>
                      <Button
                        onClick={() => {
                          console.log('[AppLayout] Downloads button clicked')
                          setIsDownloadsOpen(true)
                        }}
                        icon={downloadButtonIcon}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px'
                        }}
                      >
                        {downloadButtonText}
                      </Button>

                      <Button
                        onClick={() => {
                          console.log('[AppLayout] Uploads button clicked')
                          setIsUploadsOpen(true)
                        }}
                        icon={uploadButtonIcon}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px'
                        }}
                      >
                        {uploadButtonText}
                      </Button>

                      <TabList
                        selectedValue={activeTab}
                        onTabSelect={(_, data) => setActiveTab(data.value as ActiveTab)}
                        appearance="subtle"
                        className={styles.tabs}
                      >
                        <Tab value="games" icon={<DesktopRegular />}>
                          {t('games')}
                        </Tab>
                        <Tab value="settings" icon={<SettingsRegular />}>
                          {t('settings')}
                        </Tab>
                      </TabList>
                    </>
                  )}
                  <LocalUploadDialog />
                  <Switch
                    label={colorScheme === 'dark' ? t('darkMode') : t('lightMode')}
                    checked={colorScheme === 'dark'}
                    onChange={handleThemeChange}
                  />
                </div>
              </div>

              <div className={styles.mainContent} id="mainContent">
                <MainContent
                  currentView={currentView}
                  activeTab={activeTab}
                  onDeviceConnected={handleDeviceConnected}
                  onSkipConnection={handleSkipConnection}
                  onBackToDeviceList={handleBackToDeviceList}
                />
              </div>

              {/* Add UpdateNotification component here - it manages its own visibility */}
              <UpdateNotification />

              <Drawer
                type="overlay"
                separator
                open={isDownloadsOpen}
                onOpenChange={(_, { open }) => setIsDownloadsOpen(open)}
                position="end"
                style={{ width: '700px' }}
                mountNode={mountNodeRef.current}
              >
                <DrawerHeader>
                  <DrawerHeaderTitle
                    action={
                      <Button
                        appearance="subtle"
                        aria-label={t('close')}
                        icon={<CloseIcon />}
                        onClick={() => setIsDownloadsOpen(false)}
                      />
                    }
                  >
                    {t('downloads')}
                  </DrawerHeaderTitle>
                </DrawerHeader>
                <DrawerBody>
                  <div>
                    <DownloadsView onClose={() => setIsDownloadsOpen(false)} />
                  </div>
                </DrawerBody>
              </Drawer>

              <Drawer
                type="overlay"
                separator
                open={isUploadsOpen}
                onOpenChange={(_, { open }) => setIsUploadsOpen(open)}
                position="end"
                style={{ width: '700px' }}
                mountNode={mountNodeRef.current}
              >
                <DrawerHeader>
                  <DrawerHeaderTitle
                    action={
                      <Button
                        appearance="subtle"
                        aria-label={t('close')}
                        icon={<CloseIcon />}
                        onClick={() => setIsUploadsOpen(false)}
                      />
                    }
                  >
                    {t('uploads')}
                  </DrawerHeaderTitle>
                </DrawerHeader>
                <DrawerBody>
                  <div>
                    <UploadsView />
                  </div>
                </DrawerBody>
              </Drawer>
            </div>
            <div
              id="portal-parent"
              style={{
                zIndex: 1000,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none'
              }}
            >
              <div ref={mountNodeRef} id="portal" style={{ pointerEvents: 'auto' }}></div>
            </div>
          </GameDialogProvider>
        </GamesProvider>
      </AdbProvider>
      <CreditsDialog
        open={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
        variant="main"
      />
    </FluentProvider>
  )
}

const AppLayoutWithProviders: React.FC = () => {
  return (
    <SettingsProvider>
      <LanguageProvider>
        <DependencyProvider>
          <DownloadProvider>
            <UploadProvider>
              <AppLayout />
            </UploadProvider>
          </DownloadProvider>
        </DependencyProvider>
      </LanguageProvider>
    </SettingsProvider>
  )
}

export default AppLayoutWithProviders
