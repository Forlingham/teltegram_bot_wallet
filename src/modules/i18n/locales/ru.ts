export const ru = {
  bot: {
    start: {
      welcome:
        '🎉 Добро пожаловать в SCASH Red Packet Wallet!\n\n' +
        'Это блокчейн-кошелёк с красными конвертами, где вы можете:\n' +
        '• Отправлять и получать красные конверты SCASH\n' +
        '• Управлять кошельком\n' +
        '• Просматривать историю транзакций\n\n' +
        'Нажмите кнопку ниже, чтобы открыть кошелёк 👇',
      openWallet: '💰 Открыть кошелёк',
    },
    balance: {
      startFirst: '❌ Сначала используйте команду /start',
      noWallet: '❌ У вас ещё нет кошелька\n\nНажмите кнопку ниже, чтобы создать 👇',
      createWallet: '💰 Создать кошелёк',
      title: '💰 Баланс кошелька',
      address: 'Адрес',
      balance: 'Баланс',
      utxoCount: 'UTXO',
      openDetails: '📱 Открыть детали кошелька',
      error: '❌ Не удалось запросить баланс, попробуйте позже',
    },
    notify: {
      claimSuccess: (senderName: string, amount: string, message?: string | null) =>
        message
          ? `🧧 Поздравляем! Вы получили красный конверт от ${senderName}\n\n💰 Сумма: ${amount} SCASH\n📝 Пожелание: ${message}`
          : `🧧 Поздравляем! Вы получили красный конверт от ${senderName}\n\n💰 Сумма: ${amount} SCASH`,
      viewWallet: '📱 Посмотреть кошелёк',
      packetCompleted: (shortHash: string, totalAmount: string, claimCount: number) =>
        `🎊 Ваш красный конверт полностью разобран!\n\n` +
        `📦 ID конверта: ${shortHash}...\n` +
        `💰 Итого: ${totalAmount} SCASH\n` +
        `👥 Получателей: ${claimCount}`,
      viewDetails: '📱 Подробнее',
    },
  },
};
