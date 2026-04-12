import { Controller, Get, Inject, Redirect, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as ejs from 'ejs';
import { getScashNetwork } from '../../config/scash.networks';

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

  private buildViewData(data: Record<string, unknown>) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const network = getScashNetwork(nodeEnv);
    return {
      ...data,
      appEnv: nodeEnv,
      scashNetwork: {
        bech32: network.bech32,
        pubKeyHash: network.pubKeyHash,
        scriptHash: network.scriptHash,
      },
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
      pageTitle: '恢复钱包',
      pageSubtitle: '下载密文后在前端本地解密',
      activeNav: 'home',
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

  @Get('wallet/redpacket')
  walletRedpacketPage(@Res() res: Response) {
    return renderPage(res, 'wallet/redpacket.ejs', this.buildViewData({
      pageTitle: '红包',
      pageSubtitle: '',
      activeNav: 'redpacket',
    }));
  }

  @Get('wallet/redpacket/create')
  walletRedpacketCreatePage(@Res() res: Response) {
    return renderPage(res, 'wallet/redpacket/create.ejs', this.buildViewData({
      pageTitle: '发红包',
      pageSubtitle: '',
      activeNav: 'redpacket',
    }));
  }

  @Get('wallet/history')
  walletHistoryPage(@Res() res: Response) {
    return renderPage(res, 'wallet/history.ejs', this.buildViewData({
      pageTitle: '历史交易',
      pageSubtitle: '',
      activeNav: 'history',
    }));
  }
}