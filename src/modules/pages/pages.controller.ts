import { Controller, Get, Render } from '@nestjs/common';

@Controller()
export class PagesController {
  @Get('wallet')
  @Render('wallet/index')
  walletPage(): { pageTitle: string; pageSubtitle: string; activeNav: string } {
    return {
      pageTitle: 'SCASH 钱包',
      pageSubtitle: '钱包总览',
      activeNav: 'wallet',
    };
  }

  @Get('wallet/create')
  @Render('wallet/create')
  walletCreatePage(): { pageTitle: string; pageSubtitle: string; activeNav: string } {
    return {
      pageTitle: '创建钱包',
      pageSubtitle: '前端生成助记词并加密上传',
      activeNav: 'create',
    };
  }

  @Get('wallet/import')
  @Render('wallet/import')
  walletImportPage(): { pageTitle: string; pageSubtitle: string; activeNav: string } {
    return {
      pageTitle: '导入钱包',
      pageSubtitle: '前端加密后提交密文',
      activeNav: 'import',
    };
  }

  @Get('wallet/recover')
  @Render('wallet/recover')
  walletRecoverPage(): { pageTitle: string; pageSubtitle: string; activeNav: string } {
    return {
      pageTitle: '恢复钱包',
      pageSubtitle: '下载密文后在前端本地解密',
      activeNav: 'recover',
    };
  }

  @Get('wallet/bind')
  @Render('wallet/bind')
  walletBindPage(): { pageTitle: string; pageSubtitle: string; activeNav: string } {
    return {
      pageTitle: '绑定观察钱包',
      pageSubtitle: '仅接收，无法签名发送',
      activeNav: 'wallet',
    };
  }
}
