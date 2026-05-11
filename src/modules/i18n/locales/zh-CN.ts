export const zhCN = {
  bot: {
    start: {
      welcome:
        '🎉 欢迎使用 SCASH 红包钱包！\n\n' +
        '这是一个基于 Scash 区块链的红包钱包，你可以：\n' +
        '• 发送和接收 SCASH 红包\n' +
        '• 管理你的钱包\n' +
        '• 查看交易记录\n\n' +
        '点击下方按钮打开钱包 👇',
      openWallet: '💰 打开钱包',
    },
    balance: {
      startFirst: '❌ 请先使用 /start 命令开始',
      noWallet: '❌ 你还没有钱包\n\n点击下方按钮创建钱包 👇',
      createWallet: '💰 创建钱包',
      title: '💰 钱包余额',
      address: '地址',
      balance: '余额',
      utxoCount: 'UTXO 数量',
      openDetails: '📱 打开钱包详情',
      error: '❌ 查询余额失败，请稍后重试',
    },
    notify: {
      claimSuccess: (senderName: string, amount: string, message?: string | null) =>
        message
          ? `🧧 恭喜！你领取了 ${senderName} 的红包\n\n💰 金额: ${amount} SCASH\n📝 祝福: ${message}`
          : `🧧 恭喜！你领取了 ${senderName} 的红包\n\n💰 金额: ${amount} SCASH`,
      viewWallet: '📱 查看钱包',
      packetCompleted: (shortHash: string, totalAmount: string, claimCount: number) =>
        `🎊 你的红包已被领完！\n\n` +
        `📦 红包ID: ${shortHash}...\n` +
        `💰 总金额: ${totalAmount} SCASH\n` +
        `👥 领取人数: ${claimCount} 人`,
      viewDetails: '📱 查看详情',
    },
  },
};
