class iOSIntegration {
  constructor() {
    this.isRunningOniOS = this.checkiOSEnvironment();
    this.shortcuts = new Map();
    this.setupShortcuts();
  }

  checkiOSEnvironment() {
    // 检查是否在iOS环境中运行
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent;
      return /iPad|iPhone|iPod/.test(userAgent) || 
             (userAgent.includes('Mac') && 'ontouchend' in document);
    }
    return false;
  }

  setupShortcuts() {
    // iOS快捷指令配置
    this.shortcuts.set('addExpense', {
      name: '添加支出',
      url: 'shortcuts://run-shortcut?name=添加支出记账',
      description: '快速添加支出记录'
    });

    this.shortcuts.set('addIncome', {
      name: '添加收入', 
      url: 'shortcuts://run-shortcut?name=添加收入记账',
      description: '快速添加收入记录'
    });

    this.shortcuts.set('viewBalance', {
      name: '查看余额',
      url: 'shortcuts://run-shortcut?name=查看账户余额',
      description: '查看当前账户余额'
    });
  }

  // 生成快捷指令配置文件
  generateShortcutConfig() {
    return {
      shortcuts: [
        {
          name: "自动记账 - Apple Pay",
          actions: [
            {
              identifier: "is.workflow.actions.urlencode",
              parameters: {
                WFInput: "{{Ask for Input}}"
              }
            },
            {
              identifier: "is.workflow.actions.url",
              parameters: {
                WFURLActionURL: `${this.getAppURL()}/api/transactions/apple-pay`
              }
            },
            {
              identifier: "is.workflow.actions.downloadurl",
              parameters: {
                WFHTTPMethod: "POST",
                WFHTTPBodyType: "JSON",
                WFRequestVariable: {
                  merchant: "{{Ask for Merchant}}",
                  amount: "{{Ask for Amount}}",
                  date: "{{Current Date}}"
                }
              }
            }
          ]
        },
        {
          name: "记账 - 手动添加",
          actions: [
            {
              identifier: "is.workflow.actions.ask",
              parameters: {
                WFAskActionPrompt: "输入金额",
                WFInputType: "Number"
              }
            },
            {
              identifier: "is.workflow.actions.ask", 
              parameters: {
                WFAskActionPrompt: "选择类别",
                WFInputType: "Choose from Menu",
                WFMenuItems: ["餐饮", "交通", "娱乐", "日用品", "医疗", "服装", "教育", "其他"]
              }
            },
            {
              identifier: "is.workflow.actions.ask",
              parameters: {
                WFAskActionPrompt: "输入描述",
                WFInputType: "Text"
              }
            },
            {
              identifier: "is.workflow.actions.url",
              parameters: {
                WFURLActionURL: `${this.getAppURL()}/api/transactions`
              }
            }
          ]
        }
      ],
      widgets: [
        {
          name: "今日支出",
          size: "small",
          url: `${this.getAppURL()}/widget/today-expenses`
        },
        {
          name: "本月统计",
          size: "medium", 
          url: `${this.getAppURL()}/widget/monthly-stats`
        }
      ]
    };
  }

  // 生成PWA配置
  generatePWAManifest() {
    return {
      name: "自动记账",
      short_name: "记账",
      description: "智能自动记账应用",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#007AFF",
      orientation: "portrait",
      icons: [
        {
          src: "/icons/icon-72x72.png",
          sizes: "72x72",
          type: "image/png"
        },
        {
          src: "/icons/icon-128x128.png", 
          sizes: "128x128",
          type: "image/png"
        },
        {
          src: "/icons/icon-192x192.png",
          sizes: "192x192", 
          type: "image/png"
        },
        {
          src: "/icons/icon-512x512.png",
          sizes: "512x512",
          type: "image/png"
        }
      ],
      categories: ["finance", "productivity"],
      shortcuts: [
        {
          name: "快速记账",
          short_name: "记账",
          description: "快速添加交易记录",
          url: "/quick-add",
          icons: [{ src: "/icons/add-icon.png", sizes: "96x96" }]
        },
        {
          name: "查看统计",
          short_name: "统计", 
          description: "查看消费统计",
          url: "/stats",
          icons: [{ src: "/icons/stats-icon.png", sizes: "96x96" }]
        }
      ]
    };
  }

  // Apple Pay集成配置
  getApplePayConfig() {
    return {
      merchantIdentifier: "merchant.com.yourapp.accounting",
      displayName: "自动记账App",
      supportedNetworks: ["visa", "masterCard", "amex"],
      merchantCapabilities: ["supports3DS"],
      supportedCountries: ["CN", "US", "FR"] // 中国、美国、法国
    };
  }

  // 获取应用URL
  getAppURL() {
    return window.location ? window.location.origin : 'http://localhost:3000';
  }

  // 请求通知权限
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      throw new Error('此浏览器不支持通知功能');
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // 发送通知
  sendNotification(title, options = {}) {
    if (!this.isRunningOniOS) return;

    const defaultOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge.png',
      vibrate: [200, 100, 200],
      ...options
    };

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      // 使用Service Worker发送通知
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, defaultOptions);
      });
    } else if (Notification.permission === 'granted') {
      new Notification(title, defaultOptions);
    }
  }

  // 添加到主屏幕提示
  showInstallPrompt() {
    return {
      title: "添加到主屏幕",
      message: "将自动记账应用添加到主屏幕，方便快速访问",
      steps: [
        "点击分享按钮",
        "选择'添加到主屏幕'",
        "确认添加"
      ]
    };
  }

  // 生成快捷指令安装链接
  getShortcutInstallURL() {
    const shortcutData = encodeURIComponent(JSON.stringify(this.generateShortcutConfig()));
    return `shortcuts://shortcuts/import?data=${shortcutData}`;
  }
}

module.exports = iOSIntegration;