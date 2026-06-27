# MMY-TaskTime 极简任务计时器

> 悬浮置顶的极简任务计时器，支持多任务并行，Web版 + Tauri桌面版双形态

![version](https://img.shields.io/badge/version-v2.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri)

## ✨ 特性

### 🎯 双模式 UI
- **完整模式**：360px 白色卡片，功能齐全
- **精简模式**：156px 深色毛玻璃悬浮窗，工作时不干扰视野
- 一键切换，平滑过渡动画
- 支持窗口拖拽，可自由放置位置

### ⚡ 多任务并行
- **主任务**：当前专注任务，大字号倒计时展示
- **后台提醒任务**：多个并行，按钮上显示环形进度
- 点击启动/切换/停止，操作极简
- 主任务停止后自动切换到下一个

### 🏷️ 常驻任务（4个预设）
| 任务 | 时长 | 类型 | 说明 |
|------|------|------|------|
| 外包跟进反馈 | 5分钟 | 常规任务 | 快速处理外包沟通 |
| Agent跟进 | 10分钟 | AI循环任务 | 提醒查看Agent进度，自动循环 |
| 主任务跟进 | 30分钟 | 常规任务 | 深度专注工作 |
| 间隔喝水 | 40分钟 | 循环提醒 | 健康提醒，自动循环 |

### 📝 自定义任务
- 添加任务：名称 + 时长 + 可选循环
- 支持删除
- 最多10个任务，超出滚动
- 数据自动持久化

### 🔔 提醒机制
- Web Audio API 合成双音"叮"提示音
- 浏览器/系统桌面通知
- 上下班打卡提醒（默认 9:30 / 19:30，可自定义）
- 循环任务到点自动重启，持续提醒

### 📊 数据统计
- 今日专注时长 / 今日完成数 / 本周专注时长
- 今日任务完成明细
- **仅统计常规任务**，AI循环任务不纳入
- 支持导出 HTML 报告

### 🖥️ 桌面端专属功能（Tauri版）
- **真正窗口置顶**：无浏览器限制的系统级置顶
- **系统托盘**：快速启动任务、切换模式、设置自启、退出
- **全局快捷键**：`Ctrl+Shift+T` 切换显示/隐藏，`Ctrl+Shift+M` 切换模式
- **开机自启**：系统启动时自动运行（可在设置中开关）
- **边缘吸附**：拖到屏幕边缘自动半隐藏，鼠标悬停展开
- **任务栏隐藏**：精简模式下不出现在任务栏，仅托盘可见
- **原生窗口拖拽**：流畅的系统级拖拽体验

## 🚀 快速开始

### Web版（最简单）
直接用浏览器打开 `index.html` 即可使用。

```bash
# 或启动本地服务器
python -m http.server 8080
# 然后访问 http://localhost:8080
```

### 桌面版（Tauri）

**前置要求**：Rust 1.70+、Node.js 18+、WebView2（Windows内置）

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run tauri dev

# 打包生产版本（生成安装包到 src-tauri/target/release/bundle）
npm run tauri build
```

## 🎮 使用说明

| 操作 | 说明 |
|------|------|
| 点击常驻按钮 | 启动/停止/切换主任务 |
| 点击 ↙/↗ 按钮 | 切换完整/精简模式 |
| 拖拽顶部条 | 移动窗口位置 |
| 点击 + 号 | 添加自定义任务 |
| 点击 ⚙ | 打开设置面板 |
| 点击 📊 | 打开统计面板 |
| Ctrl+Shift+T | 桌面版：显示/隐藏窗口 |
| Ctrl+Shift+M | 桌面版：切换双模式 |
| ESC | 关闭模态框/表单 |

## 🛠️ 技术栈

### Web版
- 纯 HTML + CSS + JavaScript（无构建依赖）
- 数据存储：localStorage
- 提醒方式：Web Audio API + Notification API

### 桌面版
- **前端**：同一套Web代码（HTML/CSS/JS），无框架
- **后端**：Rust + Tauri v2
- **插件**：tauri-plugin-autostart、tauri-plugin-global-shortcut
- **系统特性**：托盘图标、全局快捷键、窗口管理、边缘吸附

## 📁 项目结构

```
MMY-TaskTime/
├── index.html              # 主页面（Web/桌面共用）
├── style.css               # 样式文件（Web/桌面共用）
├── app.js                  # 应用逻辑（Web/桌面共用，含Tauri API检测）
├── package.json            # npm脚本配置
├── README.md               # 项目说明
├── .gitignore              # Git忽略配置
├── archive/                # 历史版本归档
│   ├── v1.0-full/          # v1.0 单任务版本
│   └── v2.0-multitask/     # v2.0 多任务原型
├── 开发文档/               # 中文开发文档
│   ├── 产品需求文档.md
│   ├── 开发计划.md
│   └── 验证清单.md
└── src-tauri/              # Tauri桌面端Rust代码
    ├── Cargo.toml          # Rust依赖配置
    ├── tauri.conf.json     # Tauri应用配置
    ├── capabilities/       # 权限配置
    ├── icons/              # 应用图标
    └── src/
        └── main.rs         # Rust主程序（窗口/托盘/快捷键/边缘吸附）
```

## 📄 License

MIT
