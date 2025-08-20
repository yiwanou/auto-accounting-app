# 🚀 部署自动记账应用到iPhone

## 免费部署选项

### 选项1：Railway (推荐)

1. **创建GitHub仓库**
   - 将项目推送到GitHub
   - 确保所有文件都已提交

2. **部署到Railway**
   - 访问 https://railway.app
   - 使用GitHub登录
   - 点击"New Project"
   - 选择"Deploy from GitHub repo"
   - 选择你的自动记账应用仓库
   - Railway会自动检测并部署Node.js应用

3. **配置域名**
   - 部署成功后，Railway会提供一个免费域名
   - 类似：`https://your-app-name.railway.app`

### 选项2：Render

1. **准备GitHub仓库**
   - 确保代码已推送到GitHub

2. **部署到Render**
   - 访问 https://render.com
   - 注册/登录账户
   - 点击"New +" > "Web Service"
   - 连接GitHub仓库
   - 配置设置：
     - Build Command: `npm install`
     - Start Command: `npm start`
     - Environment: Node

3. **获取应用URL**
   - Render会提供免费域名
   - 类似：`https://your-app-name.onrender.com`

### 选项3：Vercel

1. **安装Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **部署**
   ```bash
   cd auto-accounting-app
   vercel
   ```

3. **配置**
   - 选择项目设置
   - Vercel会自动配置Node.js应用

## 在iPhone上使用

### 方法1：Safari浏览器
1. 在iPhone Safari中打开部署后的URL
2. 点击分享按钮 📤
3. 选择"添加到主屏幕"
4. 应用会像原生应用一样工作

### 方法2：通过快捷指令自动化

#### 创建基础快捷指令：
1. 打开iPhone"快捷指令"应用
2. 点击"+"创建新的快捷指令
3. 搜索"获取URL内容"操作
4. 设置URL为你的应用地址 + `/api/transactions/apple-pay/parse`
5. 添加"要求输入"操作，输入类型选择"文本"
6. 设置提示："输入Apple Pay交易信息"
7. 添加"获取URL内容"操作：
   - URL：`https://your-app.railway.app/api/transactions/apple-pay/parse`
   - 方法：POST  
   - 请求正文：JSON
   - 内容：`{"rawText": "[输入]"}`

#### 高级快捷指令（Siri集成）：
1. 基于上述快捷指令
2. 在快捷指令设置中：
   - 添加到Siri：是
   - Siri短语："智能记账"
   - 显示"添加记账"：是

3. 使用方式：
   - 说："Hey Siri，智能记账"
   - Siri会要求输入交易信息
   - 说："MIGROS CHF 25.50" 
   - 应用自动解析并记录

## 快捷指令模板

### 1. 快速记账
```javascript
// 快捷指令代码
let userInput = await ask("输入交易信息 (例: MIGROS CHF 25.50)");
let response = await fetch("https://your-app.railway.app/api/transactions/apple-pay/parse", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({rawText: userInput})
});
let result = await response.json();
if (result.success) {
  notify("记账成功: " + result.transaction.formattedAmount);
} else {
  notify("记账失败: " + result.message);
}
```

### 2. 查看余额
```javascript
let response = await fetch("https://your-app.railway.app/api/balance");
let data = await response.json();
notify("当前余额: €" + data.data.balance.toFixed(2));
```

## PWA功能

应用支持PWA（渐进式Web应用），特性包括：
- ✅ 离线缓存
- ✅ 主屏幕图标
- ✅ 全屏体验
- ✅ 推送通知（需要用户授权）

## 安全说明

- ✅ 所有数据存储在你的服务器上
- ✅ 不会收集个人银行信息
- ✅ 仅处理用户主动输入的交易信息
- ✅ 支持HTTPS加密传输

## 故障排除

### 应用无法访问
1. 检查部署状态
2. 查看服务器日志
3. 确认URL是否正确

### 快捷指令不工作
1. 检查网络连接
2. 确认API URL正确
3. 检查输入格式

### iPhone上添加到主屏幕失败
1. 确保使用Safari浏览器
2. 检查manifest.json文件
3. 确认PWA配置正确

## 成本

- **Railway**: 免费额度每月$5，足够个人使用
- **Render**: 免费层，有使用限制但个人够用
- **Vercel**: 免费层，适合个人项目
- **数据存储**: SQLite本地存储，无额外成本
- **域名**: 使用免费子域名，无需购买