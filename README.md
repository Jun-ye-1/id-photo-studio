# 证照裁剪台（HTML 版）

纯前端证件照尺寸转换工具。照片只在浏览器内处理，不会上传到服务器。

## 本地使用

直接双击 `dist/index.html` 即可。也可以在本目录启动一个静态服务器：

```powershell
python -m http.server 8080 -d dist
```

然后访问 `http://localhost:8080`。

## 功能

- 一寸、小二寸等常用预设以及自定义毫米尺寸
- 150 / 300 / 600 DPI，输出精确像素
- 拖动人物、缩放和上下位置微调
- 填满裁剪与完整保留两种模式
- JPG、PNG 导出
- 为 JPG 写入 JFIF DPI，为 PNG 写入 pHYs DPI
- 桌面端和手机端自适应界面

## 文件结构

- `dist/index.html`：页面结构
- `dist/styles.css`：视觉样式
- `dist/app.js`：图片处理与下载逻辑
- `.openai/hosting.json`：Sites 部署配置
