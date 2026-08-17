# 部署到 GitHub Pages 指南

## 快速步骤

### 1. 创建 GitHub Personal Access Token (PAT)

1. 打开 https://github.com/settings/tokens
2. 点击 **"Generate new token"** → **"Generate new token (classic)"**
3. 勾选以下权限：
   - ☑️ `repo` (完整控制私有仓库)
   - ☑️ `workflow` (可选，用于 GitHub Actions)
4. 点击 **"Generate token"**
5. **复制 Token**（只显示一次！）

### 2. 设置环境变量

```powershell
$env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxx"
```

### 3. 运行部署脚本

```powershell
cd C:\Users\Administrator\.openclaw\workspace
node deploy.js
```

### 4. 部署脚本会自动：

1. 创建或检查仓库 `xingkong576/contract-qr`
2. 上传 `contract_page.html` 到 main 分支
3. 启用 GitHub Pages（source: main, path: /）
4. 生成二维码并保存到桌面
5. 输出 Pages URL

---

## 手动部署（如果脚本失败）

### 方法 A：使用 GitHub CLI (gh)

```powershell
# 安装 gh CLI
winget install GitHub.cli

# 登录
gh auth login

# 创建仓库并推送
gh repo create contract-qr --public --source=. --push
gh repo edit contract-qr --add-label contract
```

### 方法 B：手动 git 操作

```powershell
# 初始化仓库
cd C:\Users\Administrator\.openclaw\workspace
git init
git add contract_page.html
git commit -m "Deploy contract page"

# 添加远程仓库
git remote add origin https://github.com/xingkong576/contract-qr.git

# 推送
git branch -M main
git push -u origin main

# 启用 Pages
# 访问 https://github.com/xingkong576/contract-qr/settings/pages
# Source 选择: main branch, / (root)
```

---

## 获取 Pages URL

部署成功后，访问：
```
https://xingkong576.github.io/contract-qr/
```

---

## 生成二维码

```powershell
node gen-qr.js "https://xingkong576.github.io/contract-qr/"
```

---

## 注意事项

- GitHub Pages 需要等待 1-2 分钟才能生效
- 免费账户支持自定义域名，但默认是 `*.github.io`
- 仓库必须是 Public 才能使用 Pages（免费账户）
- Token 请妥善保管，不要提交到代码库
