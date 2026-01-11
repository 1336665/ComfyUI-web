# ComfyUI-web

一个轻量级的 ComfyUI Web 控制台，支持工作流参数编辑、节点开关、模型管理与 d 站画廊式输出展示。

## 快速开始

### 一键安装交互脚本

```bash
./install.sh
```

脚本会引导你输入 ComfyUI 地址与 Web 端口，并自动安装依赖后启动服务。

### 手动安装

1. 安装依赖

```bash
npm install
```

2. 启动服务（默认端口 3000）

```bash
npm start
```

3. 浏览器访问

```
http://localhost:3000
```

## 配置说明

通过环境变量配置：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `COMFYUI_BASE_URL` | 局域网 ComfyUI 地址 | `http://127.0.0.1:8188` |
| `WORKFLOW_FILE` | 工作流 JSON 文件路径 | `./Aaalice的工作流_一键包_v12.2_正式版.cpack (1).json` |
| `PORT` | Web 服务端口 | `3000` |

示例：

```bash
COMFYUI_BASE_URL=http://192.168.1.10:8188 PORT=3000 npm start
```

## 功能说明

- **工作流全参数控制**：自动解析工作流节点，呈现开关与输入控件。
- **模型管理与切换**：登记模型并自动下拉选择（适用于 model/ckpt/vae 字段）。
- **d 站画廊**：运行任务后会在画廊展示输出图片与历史任务入口。

## 外网访问建议

推荐通过反向代理（如 Nginx/Caddy）将 Web 服务公开到外网，ComfyUI 仍保留在局域网内。
