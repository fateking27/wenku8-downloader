@echo off
chcp 65001
set "foldername=node_modules"
if exist "%cd%\%foldername%\" (
    node index.js
    pause
    goto home
) else (
    echo 缺少依赖，开始安装依赖...
    echo 请确保已安装 Nodejs 和 Yarn。
    echo 正在安装依赖...

    yarn install
    echo 依赖安装完成
    echo 开始运行程序...
    node index.js
    pause
    goto home
)
pause