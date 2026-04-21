export const isTelegramEnv = () => {
  return !!(window.Telegram?.WebApp)
}

export const detectTelegramUser = () => {
  const tg = window.Telegram?.WebApp
  if (tg?.initDataUnsafe?.user) {
    return tg.initDataUnsafe.user
  }
  return null
}