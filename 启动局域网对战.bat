@echo off
setlocal
chcp 65001 >nul
where node.exe >nul 2>&1
if errorlevel 1 goto portable
node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) < 20 ? 1 : 0)" >nul 2>&1
if errorlevel 1 goto portable
node.exe "%~dp0server\server.js" %*
if errorlevel 1 goto portable
exit /b 0

:portable
if not exist "%~dp0server\土楼争霸局域网服务器.exe" goto missing
"%~dp0server\土楼争霸局域网服务器.exe" %*
if errorlevel 1 goto missing
exit /b 0

:missing
echo 无法启动局域网服务器。请保留完整游戏文件夹。
echo 也可以安装 Node.js 的 LTS 版本，再双击此文件。
echo 下载地址：https://nodejs.org/zh-cn/download
pause
exit /b 1
