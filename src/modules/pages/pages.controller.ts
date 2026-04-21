import { Controller, Get, Inject, Redirect, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as ejs from 'ejs';
import { getScashNetwork } from '../../config/scash.networks';
import { deriveAddressFromMnemonic } from '../../common/utils/wallet-crypto.util';

const VIEWS_DIR = join(process.cwd(), 'views');

function renderPage(res: Response, template: string, data: Record<string, unknown>) {
  const layoutPath = join(VIEWS_DIR, 'layout.ejs');
  const layoutContent = readFileSync(layoutPath, 'utf-8');

  const childPath = join(VIEWS_DIR, template);
  const childContent = readFileSync(childPath, 'utf-8');

  const bodyContent = ejs.render(childContent, data, { filename: childPath });
  const html = ejs.render(layoutContent, { ...data, body: bodyContent }, { filename: layoutPath });

  return res.type('html').send(html);
}

@Controller()
export class PagesController {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  @Get('api/app/env')
  getAppEnv() {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    return { env: nodeEnv };
  }

  private buildViewData(data: Record<string, unknown>) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const network = getScashNetwork(nodeEnv);
    const poolMnemonic = this.configService.get<string>('COORDINATION_ACCOUNT_MNEMONIC') || '';
    const poolAddress = poolMnemonic ? deriveAddressFromMnemonic(poolMnemonic, nodeEnv) : '';
    const ARR_FEE_ADDRESS_MAINNET = 'scash1qdq0sa4wxav36k7a4gwxq3k6dk0ahpqfsz8xpvg';
    const ARR_FEE_ADDRESS_TESTNET = 'bcrt1q8zlevurcf7ht49v7m83jz9v8uvqyturrg2w96t';
    const arrFeeAddress = nodeEnv === 'production' ? ARR_FEE_ADDRESS_MAINNET : ARR_FEE_ADDRESS_TESTNET;
    return {
      hideBottomNav: true,
      requireFullWallet: false, // 默认不强制，需要签名的页面设为 true
      requireAnyWallet: false,  // 只要有钱包（哪怕是观察钱包）就能进
      ...data,
      appEnv: nodeEnv,
      scashNetwork: {
        bech32: network.bech32,
        pubKeyHash: network.pubKeyHash,
        scriptHash: network.scriptHash,
      },
      poolAddress,
      arrFeeAddress,
    };
  }

  @Get()
  @Redirect('/wallet')
  root() {}

  @Get('wallet')
  walletPage(@Res() res: Response) {
    return renderPage(res, 'wallet/index.ejs', this.buildViewData({
      pageTitle: 'SCASH 钱包',
      pageSubtitle: '',
      activeNav: 'home',
      hideBottomNav: false,
      backAsClose: true,
    }));
  }

  @Get('wallet/create')
  walletCreatePage(@Res() res: Response) {
    return renderPage(res, 'wallet/create.ejs', this.buildViewData({
      pageTitle: '创建钱包',
      pageSubtitle: '前端生成助记词并加密上传',
      activeNav: 'home',
    }));
  }

  @Get('wallet/import')
  walletImportPage(@Res() res: Response) {
    return renderPage(res, 'wallet/import.ejs', this.buildViewData({
      pageTitle: '导入钱包',
      pageSubtitle: '前端加密后提交密文',
      activeNav: 'home',
    }));
  }

  @Get('wallet/recover')
  walletRecoverPage(@Res() res: Response) {
    return renderPage(res, 'wallet/recover.ejs', this.buildViewData({
      pageTitle: '查看 / 备份助记词',
      pageSubtitle: '本地解密查看你的助记词',
      activeNav: 'home',
      requireFullWallet: true,
    }));
  }

  @Get('wallet/bind')
  walletBindPage(@Res() res: Response) {
    return renderPage(res, 'wallet/bind.ejs', this.buildViewData({
      pageTitle: '绑定观察钱包',
      pageSubtitle: '仅接收，无法签名发送',
      activeNav: 'home',
    }));
  }

  @Get('wallet/send')
  walletSendPage(@Res() res: Response) {
    return renderPage(res, 'wallet/send.ejs', this.buildViewData({
      pageTitle: '发送',
      pageSubtitle: '转出 SCASH',
      activeNav: 'home',
      requireFullWallet: true,
    }));
  }

  @Get('wallet/receive')
  walletReceivePage(@Res() res: Response) {
    return renderPage(res, 'wallet/receive.ejs', this.buildViewData({
      pageTitle: '接收',
      pageSubtitle: '收款地址',
      activeNav: 'home',
    }));
  }

  @Get('wallet/inscribe')
  walletInscribePage(@Res() res: Response) {
    return renderPage(res, 'wallet/inscribe.ejs', this.buildViewData({
      pageTitle: '刻字上链',
      pageSubtitle: '将文本永久刻入 SCASH',
      activeNav: 'home',
      requireFullWallet: true,
    }));
  }
  
  @Get('wallet/settings')
  walletSettingsPage(@Res() res: Response) {
    return renderPage(res, 'wallet/settings.ejs', this.buildViewData({
      pageTitle: '钱包设置',
      pageSubtitle: '安全与管理',
      activeNav: 'home',
      requireAnyWallet: true, // 允许观察者钱包进入以便解除绑定
    }));
  }

  @Get('wallet/redpacket')
  walletRedpacketPage(@Res() res: Response) {
    return renderPage(res, 'wallet/redpacket.ejs', this.buildViewData({
      pageTitle: '红包',
      pageSubtitle: '',
      activeNav: 'redpacket',
      hideBottomNav: false,
      backAsClose: true,
    }));
  }

  @Get('wallet/redpacket/create')
  walletRedpacketCreatePage(@Res() res: Response) {
    return renderPage(res, 'wallet/redpacket/create.ejs', this.buildViewData({
      pageTitle: '发红包',
      pageSubtitle: '',
      activeNav: 'redpacket',
      requireFullWallet: true,
      env: this.configService.get<string>('NODE_ENV') || 'development',
    }));
  }

  @Get('wallet/history')
  walletHistoryPage(@Res() res: Response) {
    return renderPage(res, 'wallet/history.ejs', this.buildViewData({
      pageTitle: '历史交易',
      pageSubtitle: '',
      activeNav: 'history',
      hideBottomNav: false,
      backAsClose: true,
    }));
  }

  @Get('open')
  openRedpacketPage(@Res() res: Response) {
    return renderPage(res, 'wallet/redpacket/claim.ejs', this.buildViewData({
      pageTitle: '领取红包',
      pageSubtitle: '',
      activeNav: 'redpacket',
      hideBottomNav: true,
    }));
  }

  @Get('wallet/about')
  walletAboutPage(@Res() res: Response) {
    return renderPage(res, 'wallet/about.ejs', this.buildViewData({
      pageTitle: '关于钱包',
      pageSubtitle: '',
      activeNav: 'about',
      hideBottomNav: false,
      backAsClose: true,
    }));
  }
}