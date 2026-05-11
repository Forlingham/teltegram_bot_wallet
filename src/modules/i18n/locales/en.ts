export const en = {
  bot: {
    start: {
      welcome:
        '🎉 Welcome to SCASH Red Packet Wallet!\n\n' +
        'This is a blockchain-based red packet wallet where you can:\n' +
        '• Send and receive SCASH red packets\n' +
        '• Manage your wallet\n' +
        '• View transaction history\n\n' +
        'Tap the button below to open your wallet 👇',
      openWallet: '💰 Open Wallet',
    },
    balance: {
      startFirst: '❌ Please use /start first',
      noWallet: '❌ You don\'t have a wallet yet\n\nTap the button below to create one 👇',
      createWallet: '💰 Create Wallet',
      title: '💰 Wallet Balance',
      address: 'Address',
      balance: 'Balance',
      utxoCount: 'UTXOs',
      openDetails: '📱 Open Wallet Details',
      error: '❌ Failed to query balance, please try again later',
    },
    notify: {
      claimSuccess: (senderName: string, amount: string, message?: string | null) =>
        message
          ? `🧧 Congrats! You claimed a red packet from ${senderName}\n\n💰 Amount: ${amount} SCASH\n📝 Message: ${message}`
          : `🧧 Congrats! You claimed a red packet from ${senderName}\n\n💰 Amount: ${amount} SCASH`,
      viewWallet: '📱 View Wallet',
      packetCompleted: (shortHash: string, totalAmount: string, claimCount: number) =>
        `🎊 Your red packet has been fully claimed!\n\n` +
        `📦 Packet ID: ${shortHash}...\n` +
        `💰 Total: ${totalAmount} SCASH\n` +
        `👥 Claims: ${claimCount}`,
      viewDetails: '📱 View Details',
    },
  },
};
