#!/bin/zsh
# ShadowingMaster —— 本机安装并配置 gh CLI，然后设 4 个 Secrets + push main。
# 用法：
#   双击本文件（macOS 会用 Terminal 打开运行），或终端里 `zsh scripts/setup-gh-deploy.command`
# 注意：第 1 步 gh auth login 是交互式的（会开浏览器让你授权 GitHub），需你本人操作。
set -e

PROJ=/Users/dingdongdong/Workspace/AI-APP/ShadowingMaster
DEPLOY_KEY=$HOME/.ssh/sm_deploy

echo "=========================================="
echo " 0. 安装 gh CLI"
echo "=========================================="
if command -v gh >/dev/null 2>&1; then
  echo "gh 已安装: $(gh --version | head -1)"
else
  if command -v brew >/dev/null 2>&1; then
    echo ">> 用 brew 安装 gh ..."
    brew install gh
  else
    echo ">> 未检测到 brew，改用官方二进制安装 ..."
    ARCH=$(uname -m)
    case "$ARCH" in
      arm64)   GH_ARCH=arm64 ;;
      x86_64)  GH_ARCH=x86_64 ;;
      *) echo "!! 未知架构 $ARCH"; exit 1 ;;
    esac
    VER=$(curl -fsSL https://api.github.com/repos/cli/cli/releases/latest \
          | grep -oE '"tag_name": *"v[^"]+"' | head -1 \
          | sed -E 's/.*"v([^"]+)".*/\1/')
    [ -n "$VER" ] || { echo "!! 无法获取 gh 最新版本"; exit 1; }
    URL="https://github.com/cli/cli/releases/download/v${VER}/gh_${VER}_macOS_${GH_ARCH}.zip"
    echo ">> 下载 $URL"
    TMP=$(mktemp -d)
    curl -fsSL "$URL" -o "$TMP/gh.zip"
    unzip -q "$TMP/gh.zip" -d "$TMP"
    BIN=$(find "$TMP" -name gh -type f | head -1)
    [ -n "$BIN" ] || { echo "!! 未找到 gh 二进制"; exit 1; }
    sudo cp "$BIN" /usr/local/bin/gh
    rm -rf "$TMP"
    echo ">> gh 已安装到 /usr/local/bin/gh"
  fi
fi

echo "=========================================="
echo " 1. 登录 GitHub（交互：浏览器授权）"
echo "=========================================="
if gh auth status >/dev/null 2>&1; then
  echo "gh 已登录: $(gh auth status 2>&1 | head -1)"
else
  echo ">> 请按提示在浏览器完成 GitHub 授权（选 GitHub.com / HTTPS）..."
  gh auth login
fi

echo "=========================================="
echo " 2. 配置 gh 参数"
echo "=========================================="
gh config set git_protocol https
echo "git_protocol = $(gh config get git_protocol)"

echo "=========================================="
echo " 3. 设置 4 个 GitHub Secrets（VPS_SSH_KEY 取自部署私钥）"
echo "=========================================="
[ -f "$DEPLOY_KEY" ] || { echo "!! 部署私钥 $DEPLOY_KEY 不存在，无法设置 VPS_SSH_KEY"; exit 1; }
cd "$PROJ"
gh secret set VPS_HOST     -b "8.208.16.234"
gh secret set VPS_USER     -b "root"
gh secret set DEPLOY_DOMAIN -b "api.shadowingmaster.genisource.studio"
gh secret set VPS_SSH_KEY  < "$DEPLOY_KEY"
echo ">> 4 个 Secrets 已设置：VPS_HOST / VPS_USER / DEPLOY_DOMAIN / VPS_SSH_KEY"

echo "=========================================="
echo " 4. 推送 main 触发首次自动部署"
echo "=========================================="
git push -u origin main
echo ">> push 完成。去 GitHub → Actions 看 Deploy backend 工作流，"
echo "   或稍后 curl https://api.shadowingmaster.genisource.studio/api/health 验证。"

read -r "?按回车键退出 ..."
