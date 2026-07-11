# 学时统计系统

纯静态学时统计工具，可直接部署到 GitHub Pages 使用。

## 功能

- 左侧学员列表：新增、删除、改名，胶囊进度条显示已用 / 总学时 / 剩余学时。
- 中间操作区：设置授课科目、总学时、购买节数、下次上课时间，新增课时记录。
- 课时输入仅支持 `nH mM` 形式：小时和分钟两个输入框；总分钟 / 总小时只做显示。
- 课次名称自动按 `第n节` 编号。
- 右侧数据区：导出 / 导入 XLSX、CSV、JSON；左侧导出，右侧导入。
- 支持多配色模式：暖纸、清透、森绿、墨夜；选择会自动保存在本地。
- 支持桌面、平板、手机多端适配；桌面端左右栏固定高度，内容过多时栏内滚动。
- 自动生成统计语句和学情反馈模板，可一键复制。
- 数据保存在浏览器 `localStorage`，无需数据库。

## 本地使用

直接打开 `index.html` 即可使用。

建议日常使用时定期点击 `导出 JSON`，把完整数据备份到本地文件。

## GitHub Pages 静态部署

### 1. 创建 GitHub 仓库

在 GitHub 新建一个仓库，例如：

```text
Studying-Hours-Statistics
```

仓库可以设为 Public。GitHub Pages 对 Public 仓库最省事。

### 2. 初始化并推送代码

在项目文件夹运行：

```powershell
git init
git add index.html style.css app.js README.md
git commit -m "Initial study hours statistics app"
git branch -M main
git remote add origin https://github.com/你的用户名/Studying-Hours-Statistics.git
git push -u origin main
```

如果仓库已经存在且已经绑定远程地址，只需要：

```powershell
git add index.html style.css app.js README.md
git commit -m "Update study hours app"
git push
```

### 3. 开启 GitHub Pages

进入 GitHub 仓库页面：

```text
Settings → Pages
```

配置：

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/root`

保存后等待 1–2 分钟，GitHub 会生成访问链接。

### 4. 访问地址

通常地址格式为：

```text
https://你的用户名.github.io/Studying-Hours-Statistics/
```

如果页面未立即打开，等 GitHub Pages 构建完成后刷新。

## 数据备份与恢复

- `导出 JSON`：完整备份，包含全部学员、设置、课时记录和本地缓存数据。
- `导入 JSON`：恢复完整备份，适合换电脑、换浏览器、清缓存后恢复。
- `导出 XLSX`：适合用 Excel 查看、交接或打印。
- `导入 XLSX`：支持本工具导出的 XLSX，也兼容参考表的 `H/M/min/h/left` 结构。
- `导出 CSV` / `导入 CSV`：适合轻量表格交换。

## 重要说明

本工具没有后端数据库。GitHub Pages 只负责托管网页文件；实际学员数据保存在当前浏览器的 `localStorage` 中。

因此：

- 同一个 GitHub Pages 链接，在不同电脑或不同浏览器中不会自动同步数据。
- 清理浏览器缓存可能删除本地数据。
- 长期使用必须定期 `导出 JSON` 备份。
