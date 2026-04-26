export interface TelegramUser {
  id: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  allows_write_to_pm?: boolean
  photo_url?: string
}

export interface TelegramWebApp {
  ready: () => void
  close: () => void
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string
    queryId?: string
    auth_date?: number
    hash?: string
  }
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (fn: () => void) => void
    offClick: (fn: () => void) => void
  }
  MainButton: {
    text: string
    show: () => void
    hide: () => void
    onClick: (fn: () => void) => void
  }
  showScanQrPopup: (params: { text?: string }) => void
  closeScanQrPopup: () => void
  onEvent: (event: string, fn: (data: unknown) => void) => void
  offEvent: (event: string, fn: (data: unknown) => void) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
  showPopup: (params: { title?: string; message?: string; buttons?: Array<{ type: string; text: string }> }, callback?: (buttonId: string) => void) => void
  expand: () => void
  isExpanded?: boolean
  viewportHeight?: number
  viewportStableHeight?: number
  themeParams?: Record<string, string>
  colorScheme?: 'light' | 'dark'
  version?: string
  platform?: string
}

export function useTelegram() {
  function getWebApp(): TelegramWebApp | null {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      return (window as any).Telegram.WebApp as TelegramWebApp
    }
    return null
  }

  function getTgUser(): TelegramUser | null {
    const tg = getWebApp()
    if (tg?.initDataUnsafe?.user) {
      return tg.initDataUnsafe.user
    }
    return null
  }

  function getInitData(): string {
    const tg = getWebApp()
    if (tg) {
      tg.ready()
      if (tg.initData) return tg.initData
    }
    const params = new URL(location.href).searchParams
    return params.get('tgWebAppData') || ''
  }

  function parseTgUserId(initDataStr: string): string {
    if (!initDataStr) return ''
    try {
      const params = new URLSearchParams(initDataStr)
      const userJson = params.get('user')
      if (userJson) {
        const user = JSON.parse(decodeURIComponent(userJson))
        if (user?.id) return String(user.id)
      }
    } catch {}
    return ''
  }

  // Track active back button cleanup to avoid handler accumulation
  let backCleanup: (() => void) | null = null

  function setupBackButton(handler: () => void): void {
    const tg = getWebApp()
    if (!tg) return

    // Clean up previous handler first
    if (backCleanup) {
      backCleanup()
      backCleanup = null
    }

    tg.BackButton.show()
    tg.BackButton.onClick(handler)
    backCleanup = () => {
      tg.BackButton.offClick(handler)
      tg.BackButton.hide()
    }
  }

  function hideBackButton(): void {
    const tg = getWebApp()
    // Clean up any registered handler
    if (backCleanup) {
      backCleanup()
      backCleanup = null
    } else {
      tg?.BackButton.hide()
    }
  }

  function showScanQr(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tg = getWebApp()
      if (!tg) {
        reject(new Error('Telegram WebApp not available'))
        return
      }

      tg.onEvent('qrTextReceived', (obj: unknown) => {
        tg.closeScanQrPopup()
        const data = (obj as { data: string }).data || ''
        resolve(data.trim())
      })

      tg.showScanQrPopup({ text })
    })
  }

  function showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      const tg = getWebApp()
      if (tg) {
        tg.showAlert(message, () => resolve())
      } else {
        alert(message)
        resolve()
      }
    })
  }

  function closeApp(): void {
    const tg = getWebApp()
    if (tg) tg.close()
  }

  function expandApp(): void {
    getWebApp()?.expand?.()
  }

  return {
    getWebApp,
    getTgUser,
    getInitData,
    parseTgUserId,
    setupBackButton,
    hideBackButton,
    showScanQr,
    showAlert,
    close: closeApp,
    expand: expandApp,
  }
}