# 《土楼争霸》打包 Android APK

只想把已上线的网页装进 Android 应用，选 **方案 A · PWABuilder**。希望第一次启动就能离线玩，或要加入电脑版默认的 HTTP 局域网服务器，选 **方案 B · Capacitor**。两种 APK 的联机入口都只加入房间，由电脑创建房间。

## 方案 A · 用 PWABuilder 打包

1. **发布网页。** 按 [README 的 GitHub Pages 步骤](../README.md#手动发布到-github-pages)部署。用 Chrome 打开实际的 HTTPS 试玩链接，确认能进入游戏、浏览器能找到 manifest，且首次缓存完成后断网刷新仍能运行。后续在 PWABuilder 输入试玩地址，例如 `https://YOUR_NAME.github.io/tulou-zhengba/`。
2. **打开打包工具。** 访问 [PWABuilder](https://www.pwabuilder.com/)，粘贴试玩地址并点 **Start**。检查检测页里的 Manifest 和 Service Worker。点 **Package for stores**，在 **Android** 卡片点 **Generate Package**，进入 Android 选项。[PWABuilder 官方快速入门](https://github.com/pwa-builder/PWABuilder/blob/main/docs/builder/quick-start.md)
3. **填应用信息。** 建议应用名称填「土楼争霸」、包名填 `com.tulou.zhengba`。确认 Host 和 Start URL 合成后仍在游戏目录里。例如 Host 填 `https://YOUR_NAME.github.io`，Start URL 填 `/tulou-zhengba/?apk=twa`。如果站点直接在域名根目录，Start URL 填 `/?apk=twa`。这个参数用于让 Android 端识别 TWA 的加入房间入口，网页 manifest 保持原有的启动地址。显示模式选 **Fullscreen**，主题和启动背景色用 `#0E0D12`，图标可沿用 manifest 提供的 512×512 和 maskable 图标。[PWABuilder Android 选项说明](https://github.com/pwa-builder/PWABuilder/blob/main/docs/builder/android.md)
4. **签名并下载。** 首次打包时，Signing key 选 **New**，点 **Download Package**。解压后保留测试用 `.apk`、上架用 `.aab`（如果包中提供）和 `assetlinks.json`。把 `signing.keystore`、`signing-key-info.txt` 内的密码和别名妥善备份到受控位置，后续更新沿用原来的包名和签名。只分享安装包。不要上传密钥、密码或含密钥的整包 ZIP。[PWABuilder Android 签名说明](https://github.com/pwa-builder/PWABuilder/blob/main/docs/builder/android.md#signing-key)
5. **使 TWA 通过来源验证。** 浏览器会在网站来源根目录查找 `https://YOUR_NAME.github.io/.well-known/assetlinks.json`。即使游戏地址里有 `/tulou-zhengba/`，验证文件也放在来源根目录。用项目子路径时，可在同账户的 `YOUR_NAME.github.io` 根站点发布该 JSON。若用分支发布根站点，把空白 `.nojekyll` 放在发布目录根，保留 `.well-known/`。若游戏本身已在域名根目录，要把此 JSON 复制到 Pages 发布产物的 `.well-known/`，可在工作流的导出步骤之后、上传步骤之前加 `mkdir -p web-release/.well-known && cp .well-known/assetlinks.json web-release/.well-known/assetlinks.json`。安装 APK 前，用浏览器直接打开该 URL 检查 JSON 可以访问。直接分发 APK 时核对 APK 签名指纹，若通过 Google Play 重签名，使用 Play Console 提供的应用签名证书指纹。[Chrome TWA 来源验证说明](https://developer.chrome.com/docs/android/trusted-web-activity/integration-guide)
6. **装到手机测试。** 安装生成的测试 APK，先联网打开一次并等待缓存完成，再断网重开。测试主菜单、单人闯关和本机对战。TWA 由浏览器加载网站，第一次启动依赖网络。要看安装签名状态，也可使用 `adb install -r "路径\应用名.apk"` 安装到已打开 USB 调试的测试设备。[Android 应用签名说明](https://developer.android.com/studio/publish/app-signing)

**TWA 的局域网加入条件**　TWA 页面运行在 HTTPS。浏览器会阻止它打开普通 `ws://` 局域网 WebSocket，所以本项目的默认 HTTP 主机请选择方案 B。已有局域网 TLS 反向代理时，可把代理的 `/ws` 转到电脑服务器 `/ws`，确保它转发 WebSocket Upgrade、Origin 和子协议。电脑服务器按网页来源（只有协议和域名）启动，例如 `node server/server.js --twa-origin=https://YOUR_NAME.github.io`。手机输入私有 IP 的 `wss://` 地址和房间码。证书要包含该 IP，并由 Android 浏览器信任。只在可信的本地网络内使用此入口。[Chrome TWA 说明](https://developer.chrome.com/docs/android/trusted-web-activity/overview)

## 方案 B · 用 Capacitor 打包本地游戏文件

### 1. 安装工具并创建外壳

安装 Node.js 22 或更新版本、Android Studio，以及 Capacitor 8 使用的 Android SDK 36。Android Studio 的 SDK Manager 可安装 SDK，第一次 Gradle 同步通常需要联网。APK 安装后，纯单人和同屏对战可在首次启动时直接离线运行。[Capacitor 开发环境](https://capacitorjs.com/docs/getting-started/environment-setup) · [Android SDK 对照](https://capacitorjs.com/docs/android/setting-target-sdk)

在 PowerShell 运行以下命令。示例把 Android 工程放在游戏目录外，保持当前游戏可以直接双击运行。

```powershell
New-Item -ItemType Directory -Path 'D:\tulou-android'
Set-Location 'D:\tulou-android'
npm init -y
npm install @capacitor/core@8 @capacitor/android@8
npm install --save-dev @capacitor/cli@8
node 'D:\漳州游戏\tools\export-web.cjs' 'D:\tulou-android\www'
npx cap init '土楼争霸' 'com.tulou.zhengba' --web-dir www
```

导出命令需要新建或空的目标目录。若以后替换网页内容，先将旧 `www` 移到工程外，再导出到新的 `www`，然后运行 `npx cap sync android`。

将初始化生成的配置整理为 `capacitor.config.json`，使用下列内容。若初始化生成了 `capacitor.config.ts`，先把它移到工程外，确保 Capacitor 只读取一个配置文件。

```json
{
  "appId": "com.tulou.zhengba",
  "appName": "土楼争霸",
  "webDir": "www",
  "android": {
    "backgroundColor": "#0E0D12"
  },
  "server": {
    "hostname": "localhost",
    "androidScheme": "http",
    "cleartext": true
  }
}
```

WebView 从应用内的 `www` 加载资源，来源是 `http://localhost`，电脑版会用该来源识别 APK 的加入房间请求。保持该配置，主机地址从游戏里输入。这里的页面和默认联机地址都使用 HTTP 方案，可保持 `allowMixedContent` 默认值；切换 WebView 到 HTTPS 会触发混合内容限制并改变服务端预期的来源。[Capacitor 配置说明](https://capacitorjs.com/docs/config)

```powershell
npx cap add android
```

### 2. 横屏和局域网连接

编辑 `android/app/src/main/AndroidManifest.xml`，在**已有**的标签上补以下属性，保留现有的组件、主题和 Intent 配置。

- 确保 `<manifest>` 下已有 `<uses-permission android:name="android.permission.INTERNET" />`。
- 给 `<application>` 加 `android:appCategory="game"` 和 `android:usesCleartextTraffic="true"`，允许这个打包版本连接电脑的局域网 HTTP 主机。
- 给 `MainActivity` 对应的 `<activity>` 加 `android:screenOrientation="sensorLandscape"`，横屏两侧都可玩。设备若因系统策略使用竖屏，游戏仍会显示「请横过来玩」。

如工程已经配置 `android:networkSecurityConfig`，在它引用的 XML 中也启用此版本所需的明文策略，推荐在有固定主机时只为相应主机放开。此项目的加入表单限制普通 HTTP 地址为私有局域网地址；在应用中保留这个限制。上面的示例使用 Capacitor 8 默认目标 SDK 36。日后若把目标提高到 Android 17 / SDK 37，输入局域网地址直接连接的方式还需声明并动态请求 `ACCESS_LOCAL_NETWORK`，再做实机测试。[Android 网络安全配置](https://developer.android.com/privacy-and-security/security-config) · [横竖屏策略](https://developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability) · [本地网络权限](https://developer.android.com/privacy-and-security/local-network-permission)

### 3. 生成图标和启动画面

项目的 `assets/android/` 里有各密度的启动器图标、自适应图标的前景与背景，以及 2732×2732 的深色启动图 `splash.png`。用 Capacitor 工具从这些图生成当前工程的资源。

```powershell
npm install --save-dev @capacitor/assets@4
New-Item -ItemType Directory -Path '.\assets' -Force | Out-Null
Copy-Item -LiteralPath 'D:\漳州游戏\assets\images\logo_round.png' -Destination '.\assets\icon-only.png'
Copy-Item -LiteralPath 'D:\漳州游戏\assets\android\icon-foreground.png' -Destination '.\assets\icon-foreground.png'
Copy-Item -LiteralPath 'D:\漳州游戏\assets\android\icon-background.png' -Destination '.\assets\icon-background.png'
Copy-Item -LiteralPath 'D:\漳州游戏\assets\android\splash.png' -Destination '.\assets\splash.png'
Copy-Item -LiteralPath 'D:\漳州游戏\assets\android\splash.png' -Destination '.\assets\splash-dark.png'
npx @capacitor/assets generate --android
```

也可将已有的 `mipmap-mdpi` 到 `mipmap-xxxhdpi` 里的两个启动器 PNG 复制到 Android 工程对应的 `android/app/src/main/res/mipmap-*` 目录。Android 12 及以上的系统启动画面采用居中图标和纯色背景。在工程的 `res/values/styles.xml` 中，沿用已有 Launch 主题的父主题，设置 `windowSplashScreenBackground` 为 `#0E0D12`，`windowSplashScreenAnimatedIcon` 为 `@mipmap/ic_launcher`。进入游戏后，项目自带的开门动画继续播放。[Capacitor 图标和启动图](https://capacitorjs.com/docs/guides/splash-screens-and-icons) · [Android 系统启动画面](https://developer.android.com/develop/ui/views/launch/splash-screen)

### 4. 真机验证与打包

```powershell
npx cap sync android
npx cap open android
```

在 Android Studio 等 Gradle 下载后，连接打开 USB 调试的测试手机，用 **Run** 真机运行一次。打开飞行模式验证首次启动、开场和同屏。重新打开 Wi-Fi 后让手机与电脑进入同一网络，电脑通过局域网服务器创建房间，手机在「双人对决」中输入电脑显示的局域网地址与房间码加入。核对没有创建按钮，并完成准备、开战和结算。

需要可分发包时，在 Android Studio 选 **Build → Generate Signed App Bundle or APK → APK**，选择或创建签名库，选 `release` 并完成构建。在 `android/app/build/outputs/` 查找产物。发往 Google Play 时用对应的 **Android App Bundle** 选项。签名库、别名和密码独立备份，后续用相同签名发布覆盖更新。[Android Studio 打包发布](https://developer.android.com/build/build-for-release) · [Android 签名](https://developer.android.com/studio/publish/app-signing)
