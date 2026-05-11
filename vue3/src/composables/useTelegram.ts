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

export interface SafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
}

export interface ContentSafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
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
  // Bot API 7.0+ — SettingsButton
  SettingsButton?: {
    isVisible?: boolean
    show: () => void
    hide: () => void
    onClick: (fn: () => void) => void
    offClick: (fn: () => void) => void
  }
  // Bot API 8.0+ — HapticFeedback
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  // Bot API 8.0+ — Add to Home Screen
  addToHomeScreen?: () => void
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

  // Bot API 6.1+
  headerColor?: string
  backgroundColor?: string
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void

  // Bot API 7.7+
  isVerticalSwipesEnabled?: boolean
  enableVerticalSwipes?: () => void
  disableVerticalSwipes?: () => void

  // Bot API 7.10+
  bottomBarColor?: string
  setBottomBarColor?: (color: string) => void

  // Bot API 8.0+ — Fullscreen mode
  isFullscreen?: boolean
  requestFullscreen?: () => void
  exitFullscreen?: () => void
  safeAreaInset?: SafeAreaInset
  contentSafeAreaInset?: ContentSafeAreaInset
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
        // Import lazily to avoid a circular dep at module-load time.
        import('@/i18n').then(({ t }) => {
          reject(new Error(t('redpacketClaim.notInTelegram')))
        }).catch(() => reject(new Error('Please use the scan feature inside Telegram')))
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

  // ---- Bot API 6.1+ — Header/background color ----

  function setHeaderColor(color: string): void {
    const tg = getWebApp()
    try {
      tg?.setHeaderColor?.(color)
    } catch (e) {
      console.warn('[Telegram] setHeaderColor failed:', e)
    }
  }

  function setBackgroundColor(color: string): void {
    const tg = getWebApp()
    try {
      tg?.setBackgroundColor?.(color)
    } catch (e) {
      console.warn('[Telegram] setBackgroundColor failed:', e)
    }
  }

  // ---- Bot API 7.10+ — Bottom bar color ----

  function setBottomBarColor(color: string): void {
    const tg = getWebApp()
    try {
      tg?.setBottomBarColor?.(color)
    } catch (e) {
      console.warn('[Telegram] setBottomBarColor failed:', e)
    }
  }

  // ---- Bot API 7.7+ — Vertical swipes control ----

  function disableVerticalSwipes(): void {
    const tg = getWebApp()
    try {
      tg?.disableVerticalSwipes?.()
    } catch (e) {
      console.warn('[Telegram] disableVerticalSwipes failed:', e)
    }
  }

  function enableVerticalSwipes(): void {
    const tg = getWebApp()
    try {
      tg?.enableVerticalSwipes?.()
    } catch (e) {
      console.warn('[Telegram] enableVerticalSwipes failed:', e)
    }
  }

  // ---- Bot API 8.0+ — Fullscreen mode ----

  /**
   * Check if the Telegram client supports a specific Bot API version.
   */
  function isVersionAtLeast(version: string): boolean {
    const tg = getWebApp()
    if (!tg?.version) return false
    const [major, minor = 0] = tg.version.split('.').map(Number)
    const [reqMajor, reqMinor = 0] = version.split('.').map(Number)
    return major > reqMajor || (major === reqMajor && minor >= reqMinor)
  }

  /**
   * Check if the current platform is a mobile device (not desktop).
   * Desktop platforms: tdesktop, weba, webk, web, macos, unigram
   */
  function isMobilePlatform(): boolean {
    const tg = getWebApp()
    if (!tg?.platform) return true // default to mobile if unknown
    const desktop = ['tdesktop', 'weba', 'webk', 'web', 'macos', 'unigram']
    return !desktop.includes(tg.platform.toLowerCase())
  }

  function requestFullscreen(): boolean {
    const tg = getWebApp()
    if (tg?.requestFullscreen) {
      try {
        tg.requestFullscreen()
        return true
      } catch (e) {
        console.warn('[Telegram] requestFullscreen threw:', e)
        return false
      }
    }
    return false
  }

  function exitFullscreen(): void {
    const tg = getWebApp()
    if (tg?.exitFullscreen) {
      tg.exitFullscreen()
    }
  }

  function isFullscreen(): boolean {
    return getWebApp()?.isFullscreen ?? false
  }

  /**
   * Get the device safe area insets (notch, navigation bar, etc.).
   * Returns zeros if not available.
   */
  function getSafeAreaInset(): SafeAreaInset {
    return getWebApp()?.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 }
  }

  /**
   * Get the content safe area insets (Telegram header overlay, etc.).
   * Returns zeros if not available.
   */
  function getContentSafeAreaInset(): ContentSafeAreaInset {
    return getWebApp()?.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 }
  }

  // ---- Bot API 7.0+ — SettingsButton ----

  /**
   * Show the SettingsButton in the top-right menu.
   * When clicked, navigates to the provided callback.
   */
  function setupSettingsButton(handler: () => void): void {
    const tg = getWebApp()
    if (!tg?.SettingsButton) {
      console.warn('[Telegram] SettingsButton not available in this client version')
      return
    }
    tg.SettingsButton.show()
    tg.SettingsButton.onClick(handler)
  }

  /**
   * Hide the SettingsButton and remove the click handler.
   */
  function hideSettingsButton(handler?: () => void): void {
    const tg = getWebApp()
    if (!tg?.SettingsButton) return
    if (handler) {
      tg.SettingsButton.offClick(handler)
    }
    tg.SettingsButton.hide()
  }

  // ---- Bot API 8.0+ — Add to Home Screen ----

  /**
   * Prompt the user to add the Mini App to their phone's home screen.
   * Returns true if the method is available, false otherwise.
   */
  function addToHomeScreen(): boolean {
    const tg = getWebApp()
    if (tg?.addToHomeScreen) {
      try {
        tg.addToHomeScreen()
        return true
      } catch (e) {
        console.warn('[Telegram] addToHomeScreen failed:', e)
        return false
      }
    }
    console.warn('[Telegram] addToHomeScreen not available in this client version')
    return false
  }

  // ---- Bot API 6.1+ — HapticFeedback ----

  /**
   * Trigger an impact haptic feedback.
   * @param style - 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
   */
  function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium'): void {
    const tg = getWebApp()
    try {
      tg?.HapticFeedback?.impactOccurred(style)
    } catch (e) {
      console.warn('[Telegram] hapticImpact failed:', e)
    }
  }

  /**
   * Trigger a notification haptic feedback.
   * @param type - 'error' | 'success' | 'warning'
   */
  function hapticNotification(type: 'error' | 'success' | 'warning' = 'success'): void {
    const tg = getWebApp()
    try {
      tg?.HapticFeedback?.notificationOccurred(type)
    } catch (e) {
      console.warn('[Telegram] hapticNotification failed:', e)
    }
  }

  /**
   * Trigger a selection change haptic feedback.
   */
  function hapticSelection(): void {
    const tg = getWebApp()
    try {
      tg?.HapticFeedback?.selectionChanged()
    } catch (e) {
      console.warn('[Telegram] hapticSelection failed:', e)
    }
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
    // Color customization
    setHeaderColor,
    setBackgroundColor,
    setBottomBarColor,
    // Swipe control
    disableVerticalSwipes,
    enableVerticalSwipes,
    // Fullscreen
    isVersionAtLeast,
    isMobilePlatform,
    requestFullscreen,
    exitFullscreen,
    isFullscreen,
    getSafeAreaInset,
    getContentSafeAreaInset,
    // SettingsButton
    setupSettingsButton,
    hideSettingsButton,
    // Add to Home Screen
    addToHomeScreen,
    // HapticFeedback
    hapticImpact,
    hapticNotification,
    hapticSelection,
  }
}