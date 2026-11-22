# 土楼争霸 · 漳州电竞+

《土楼争霸》是面向「电竞+」比赛的闽南风塔防游戏。玩家布置文官、武将和丑角布袋木偶守住土楼，也可以在闯关地图和闽南藏宝阁探索漳州文化。

**在线试玩**　[打开《土楼争霸》](https://aqiao021.github.io/tulou-zhengba/)

## 上手操作

- **闯关**　在底部选择木偶，点击空石台布阵。点已有木偶升级，攒满福气后点「五福临门」。键盘用 1/2/3 选木偶，空格放大招。
- **双人对决**　从主菜单进入「双人对决」。同屏时各点自己一侧的面板和石台；跨设备时按下文创建或加入房间。
- **手机**　横屏游玩。支持全屏的浏览器会在第一次点击时尝试全屏。

## 版本对照

| 功能 | 网页版（GitHub Pages） | 电脑版（完整游戏文件夹） | Android APK |
|---|---|---|---|
| 单人闯关、同屏双人 | 支持 | 支持，双击 `index.html` 即可 | 支持 |
| 创建局域网房间 | 电脑版专属 | 运行局域网服务器后支持 | 由电脑版创建 |
| 加入局域网房间、观战 | 电脑版专属 | 在局域网服务器页扫码或输码 | Capacitor 版可输入电脑主机地址和房间码。TWA 版需要可信的 WSS 主机 |
| 离线单人、同屏双人 | 首次访问并完成缓存后可离线 | 游戏文件在本机时可离线 | Capacitor 首次启动即可离线。TWA 首次联网并完成缓存后可离线 |
| 开场、闯关地图、藏宝阁、戏台、福签、解说和打击感 | 支持 | 支持 | 支持 |

Android 打包见[打包 APK 说明](docs/打包APK说明.md)。知识卡朗读需要系统提供中文语音。

## 第三方授权与创作说明

- 得意黑（Smiley Sans Oblique，v2.0.1）和 Oswald 采用 SIL Open Font License 1.1。具体字体版本、作者和许可文件见下文。离线二维码使用 QRCode.js，采用 MIT 许可，许可文本随库保存在 `js/vendor/qrcode.LICENSE`。
- Windows 便携服务器基于 Node.js SEA，Node.js 及其所含第三方许可见 `server/LICENSE.node.txt`。
- 游戏美术和部分代码由 AI 工具辅助生成。项目策划、文化调研、设计决策和测试由团队完成。知识卡中标记「待核实」的内容仍需查证。

## 怎么运行
双击 `index.html`，用浏览器打开就能玩（推荐 Chrome / Edge）。不需要联网，也不用安装任何东西。
双击打开时，「局域网对战」会显示「电脑版专属」并提供「改用本机对战」。手机浏览器也可访问下文的局域网网址。GitHub Pages 使用 HTTPS，支持浏览器 PWA 安装和离线游玩。

## 怎么玩
- 在底部选一个木偶（也可以按数字键 1/2/3），再点地图上的空位放下。
- 点已经放好的木偶可以升级，最多 3 级。
- 击败敌人得福币；攒满福气后点「五福临门」（或按空格）放全屏大招。
- 右上角按钮：提前开始下一波、2 倍速、音效开关、暂停。
- 通关或首次放置木偶后可解锁漳州文化知识卡，在「闽南藏宝阁」查看。点开新卡详情后，「新」角标会消失。

## 藏宝阁与戏台教学

从主菜单进入「闽南藏宝阁」，点已收集的卡片查看插画、介绍和相关关卡。详情可以用方向键或触屏左右滑动换卡。朗读按钮使用浏览器的中文语音，能否发声取决于设备可用的语音。

从主菜单进入「玩法说明」，用底部木牌、方向键或触屏滑动切换五页教学。点「去试试！」打开闯关地图。

## 漳州闯关地图

从主菜单点「开始游戏」，再选关卡并点「出战！」。手机横屏时点徽章可看关卡信息。键盘用方向键切换已解锁关卡，Enter 查看或出战，Esc 返回。

通关满血得三颗星，血量至少一半得两颗星，其余得一颗星。最好成绩按星级、剩余血量、击败数依次比较，保存在浏览器本地。旧存档保留解锁与通关状态，下次通关时补记成绩。总星数上限涵盖地图上的四个主线关卡。

## 双人对决
主菜单点「双人对决」，选择「局域网对战」或「本机对战」。先打爆对方土楼获胜。3 分钟到时比土楼血量，平局加时 30 秒。

### 本机对战

两人在同一台设备上操作。双击 `index.html` 打开游戏即可开始，适合作为比赛现场网络不稳定时的备用。

- **红方（左）键盘**：1/2/3 选木偶 · A/D 选空位 · 空格 放置/升级 · Q/E/R 派兵（小妖/小鬼/大汉）· W/S 换出兵路线 · F 大招
- **金方（右）鼠标**：点右下面板和右半场空位；也可以用键盘 7/8/9 · ←/→ · Enter · I/O/P · ↑/↓ · L
- 平板/触屏：两人各点自己那一侧的面板

## 局域网对战

1. **连接同一个网络。** 主机、另一位玩家和观战设备都连同一个 Wi-Fi。学校 Wi-Fi 如果隔离了设备，可以用手机开热点，让主机和其他设备都连到该热点。
2. **启动服务器。** 在 Windows 主机上保留完整的游戏文件夹，双击 `server/土楼争霸局域网服务器.exe`。也可以双击游戏文件夹里的 `启动局域网对战.bat`。如果 Windows 防火墙询问，请在本次使用的可信网络上点击「允许访问」。程序会打开主机网页，并在控制台列出局域网访问网址。对局期间请保持控制台开启。
3. **创建和加入房间。** 主机在网页里点「双人对决」→「局域网对战」→「创建房间」，成为红方。另一台设备扫描房间二维码，或在浏览器输入控制台上显示的局域网网址，选择「加入房间」并输入 4 位房间码，成为金方。已有两位玩家时，其他设备用同一个房间码进入只读观战，可以把观战页面投到大屏幕。
4. **准备开赛。** 双方可在等待大厅修改昵称并查看连接状态和延迟。双方都点「准备」后，由红方点「开始」。两台设备都可用鼠标或触屏，键盘均为 1/2/3 选木偶、A/D 选空位、空格放置或升级、Q/E/R 派兵、W/S 换路、F 放大招。结算时双方都可以生成福签，双方点「再来一局」后开始下一局。

安卓 Capacitor 版从「双人对决」进入「加入房间」，填电脑控制台上显示的局域网地址和 4 位房间码。电脑要和手机连在同一个网络。GitHub 源码仓库排除了本机的 SEA 可执行文件，从源码获取项目时可以用 Node.js 和 `启动局域网对战.bat` 启动。

### 常见问题

- **另一台设备打不开网页。** 检查设备是否在同一个网络，并在客机上用控制台显示的局域网地址，例如 `http://192.168.1.5:8080/`。主机自动打开的 `127.0.0.1` 地址只供主机使用。如果控制台列出多个网卡地址，请选与当前 Wi-Fi 或热点对应的地址，再检查 Windows 防火墙是否已允许访问。学校网络仍连不上时，换手机热点再启动。
- **8080 端口被占用。** 服务器会自动尝试下一个端口。用本次启动后控制台显示的网址和房间二维码，网址中的端口可能是 8081 或更高。
- **双击后提示缺少 Node.js。** 优先运行游戏自带的 Windows x64 服务器程序。若使用批处理且缺少可用的服务器程序，请安装 Node.js 的 LTS 版后重新双击批处理。已装 Node.js 20 或更新版本时，也可在游戏目录执行 `node server/server.js`。服务器只使用 Node.js 内置模块，无需安装 npm 依赖。[Node.js 官方下载](https://nodejs.org/zh-cn/download)
- **对战中掉线。** 网页会尝试自动重连。标签页关掉后，可用同一浏览器重新打开原邀请网址，或访问同一个局域网网址并输入原房间码。对局最多等待 30 秒，超时判在线方获胜。主机服务器关闭时，客机会收到断开提示并返回主菜单。

## 手动发布到 GitHub Pages

1. 登录自己的 GitHub，点右上角 **＋ → New repository**，填写仓库名，例如 `tulou-zhengba`。使用 GitHub Free 时可选 **Public**。本地已有项目，创建时把 README、.gitignore 和 License 初始化选项留空。[GitHub 新建仓库说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。项目已有 `.github/workflows/pages.yml`，提交到 `main` 后会部署导出的游戏运行文件。[GitHub 发布来源说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
3. 在本地项目根目录打开 PowerShell，先用 `git status --short` 核对文件，再运行以下命令，把 `YOUR_NAME` 和仓库名替换成自己的值。首次用 Git 时，提交前可用 `git config --local user.name "公开昵称"` 和 `git config --local user.email "YOUR_NOREPLY_EMAIL"` 设置本仓库的署名和邮箱。noreply 邮箱从自己的 GitHub 邮箱设置复制。

   ```powershell
   git add .
   git commit -m "Prepare Tulou Zhengba for GitHub Pages"
   git remote add origin https://github.com/YOUR_NAME/tulou-zhengba.git
   git push -u origin main
   ```

   已配置 `origin` 时，用 `git remote -v` 核对，确需更换时运行 `git remote set-url origin https://github.com/YOUR_NAME/tulou-zhengba.git`。
4. 进 **Actions** 查看 **Deploy the game to GitHub Pages**。如果空仓库还无法设置发布来源，先推送，再选 **GitHub Actions**，最后在此工作流中点 **Run workflow** 并选 `main`。部署成功后从 **Settings → Pages** 打开实际网址，填入 README 顶部的试玩占位。普通项目仓库的网址形如 `https://YOUR_NAME.github.io/tulou-zhengba/`。[GitHub Pages 站点地址说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

发布流程用 `pwa-files.json` 选择运行文件，不会把设计原图、截图、文档或局域网服务器部署到试玩站点。更换素材时，同步更新该清单。首次在线打开后等待缓存完成，手机可在支持安装的浏览器菜单里选择「安装应用」或「添加到主屏幕」。新版部署后，关闭旧游戏标签再打开即可让新版离线缓存接管。

## 文件结构
```
index.html          页面结构
css/style.css       界面样式
js/data.js          ★ 所有数值、文字、关卡、知识卡、解说台词（改游戏内容就改这里）
js/game.js          单人闯关逻辑和绘制
js/versus.js        双人对决模式
js/net.js           局域网大厅、连接与对战同步
js/mobile.js        手机首次点击全屏
js/pwa.js           注册离线缓存
js/vendor/          离线二维码库及其许可
js/juice.js         打击感：震屏、顿帧、闪白、粒子、合成音效
js/levelmap.js      卷轴选关地图、关卡信息与出战过场
js/gallery.js       闽南藏宝阁与知识卡详情
js/help.js          布袋戏台教学、属性图鉴与键位
assets/images/      美术图片（文件名见 ART_SPEC.md）
assets/fonts/       LOGO 排版字体及其许可文本
assets/icons/       浏览器 PWA 图标
assets/android/     Android 启动器图标和启动图
assets/sfx/         音效 mp3
docs/               关卡路线参考图（给画背景的同学用）
ART_SPEC.md         美术需求清单
CODEX_TASKS.md      后续开发任务（分阶段提示词）
server/             局域网静态文件和 WebSocket 服务器及 Windows 启动程序
tools/export-web.cjs  导出 GitHub Pages 与 Capacitor 使用的纯静态文件
启动局域网对战.bat  Windows 局域网启动入口
```

## 替换美术
按 `ART_SPEC.md` 里的文件名，把 PNG 图片放进 `assets/images/`，刷新页面就会自动替换。没放图片的地方会继续显示占位图形。

## LOGO 与字体授权

- 中文用得意黑（Smiley Sans Oblique，v2.0.1），由 atelierAnchor 发布，采用 SIL Open Font License 1.1，可用于商业设计。原版字体及许可文本位于 `assets/fonts/SmileySans-Oblique.ttf` 和 `assets/fonts/SmileySans-OFL.txt`。[作者官网下载](https://atelier-anchor.com/typefaces/smiley-sans/) · [原版许可](https://github.com/atelier-anchor/smiley-sans/blob/v2.0.1/LICENSE)
- 英文用 Oswald Bold（可变字体字重 700），采用 SIL Open Font License 1.1，可用于商业设计。原版字体及许可文本位于 `assets/fonts/Oswald.ttf` 和 `assets/fonts/Oswald-OFL.txt`。[Google Fonts 官方字体库](https://github.com/google/fonts/tree/main/ofl/oswald) · [原版许可](https://github.com/google/fonts/blob/main/ofl/oswald/OFL.txt)
- `logo_full.png` 是排版完成的横幅版。开场动画叠加 `logo_min_emblem.png` 和实时排版的文字，三张插画位于 `assets/images/intro/`，生图原稿位于 `原图/intro/`。福签页脚用 `logo_round.png`，浏览器和苹果触屏图标由无文字的徽章导出。三张 4096×4096 的透明 LOGO 母版位于 `原图/`。

## 修改内容
- 知识卡文字：`js/data.js` 里的 `cards`（标【待核实】的请查证后修改）
- 解说台词：`js/data.js` 里的 `commentary`
- 难度：`js/data.js` 里每关的 `startFu`（初始福币）、`hpScale`（敌人血量倍数）、`waves`（波次）

## 清除存档
存档（通关记录、知识卡）保存在浏览器里。想重新体验，在浏览器控制台输入 `localStorage.clear()` 再刷新页面。

## 打击感与音效
- 命中闪白、被打扁、击退、伤害数字；鞭炮炸开有火花 + 红纸屑 + 冲击波；大汉被击败和大招会顿帧、震屏；金币会飞进福币栏。
- 开关在 `js/juice.js` 顶部的 `cfg`（shake 震屏 / hitstop 顿帧 / numbers 伤害数字）。
- 音效：`assets/sfx/` 里有同名 mp3 就播放 mp3，没有就用浏览器现场合成的锣鼓、鞭炮、木鱼声（名字见 ART_SPEC.md，另外还有 `kill` 击败、`bigkill` 击败大汉）。
