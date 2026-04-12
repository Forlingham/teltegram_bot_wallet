import { Controller, Get, Inject, Res } from '@nestjs/common';
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

  @Get('wallet')
  walletPage(@Res() res: Response) {
    return renderPage(res, 'wallet/index.ejs', this.buildViewData({
      pageTitle: 'SCASH 钱包',
      pageSubtitle: '钱包总览',
      activeNav: 'wallet',
    }));
  }

  @Get('wallet/create')
  walletCreatePage(@Res() res: Response) {
    return renderPage(res, 'wallet/create.ejs', this.buildViewData({
      pageTitle: '创建钱包',
      pageSubtitle: '前端生成助记词并加密上传',
      activeNav: 'create',
    }));
  }

  @Get('wallet/import')
  walletImportPage(@Res() res: Response) {
    return renderPage(res, 'wallet/import.ejs', this.buildViewData({
      pageTitle: '导入钱包',
      pageSubtitle: '前端加密后提交密文',
      activeNav: 'import',
    }));
  }

  @Get('wallet/recover')
  walletRecoverPage(@Res() res: Response) {
    return renderPage(res, 'wallet/recover.ejs', this.buildViewData({
      pageTitle: '恢复钱包',
      pageSubtitle: '下载密文后在前端本地解密',
      activeNav: 'recover',
    }));
  }

  @Get('wallet/bind')
  walletBindPage(@Res() res: Response) {
    return renderPage(res, 'wallet/bind.ejs', this.buildViewData({
      pageTitle: '绑定观察钱包',
      pageSubtitle: '仅接收，无法签名发送',
      activeNav: 'wallet',
    }));
  }
}