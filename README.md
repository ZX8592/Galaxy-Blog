# 星系博客

这是一个基于 `Vite + Three.js` 的宇宙博客，首页是可交互的星系场景，`/editer/` 页面可以直接编辑博客数据。

现在项目已经适配：

- GitHub Pages 自动部署
- `index.html` 和 `editer/index.html` 同时构建
- 编辑器通过 GitHub Token 直接读取和修改仓库里的 `src/blogData.js`

## 本地开发

```bash
npm install
npm run dev
```

本地开发模式下：

- 主页地址：`http://localhost:5173/`
- 编辑器地址：`http://localhost:5173/editer/`
- 如果没有填写 GitHub 仓库配置，编辑器会继续使用本地 `/api/blogData` 直接保存到 `src/blogData.js`

## 上传到 GitHub

如果你还没有仓库，可以在项目目录执行：

```bash
git init
git add .
git commit -m "init galaxy blog"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

如果你已经有仓库，只需要把当前项目推上去：

```bash
git add .
git commit -m "prepare for github pages"
git push
```

## 开启 GitHub Pages

1. 打开仓库的 `Settings`
2. 进入 `Pages`
3. 在 `Build and deployment` 里把 `Source` 设为 `GitHub Actions`
4. 推送代码后，仓库里的 `.github/workflows/deploy.yml` 会自动构建并发布

首次部署完成后，你的站点通常会出现在：

`https://你的用户名.github.io/你的仓库名/`

编辑器页面地址通常是：

`https://你的用户名.github.io/你的仓库名/editer/`

## 生成 GitHub Token

推荐使用 Fine-grained Personal Access Token。

创建方式：

1. 打开 GitHub 头像菜单里的 `Settings`
2. 进入 `Developer settings`
3. 打开 `Personal access tokens`
4. 选择 `Fine-grained tokens`
5. 新建一个 Token，并把仓库权限授予你的博客仓库

建议权限：

- `Contents`: `Read and write`
- `Metadata`: `Read-only`

如果你使用经典 Token，给 `repo` 权限即可。

## 如何用编辑器直接改仓库

部署完成后，打开站点的 `/editer/` 页面，在顶部填入：

- `GitHub 用户名`
- `仓库名`
- `分支名`，通常是 `main`
- `数据文件路径`，默认保持 `src/blogData.js`
- `GitHub Token`

然后：

1. 点击“保存连接配置”
2. 点击“从 GitHub 读取”确认当前线上内容
3. 修改首页文案、行星内容或卫星内容
4. 点击“保存到 GitHub”

编辑器会直接把 `src/blogData.js` 提交回仓库。提交完成后，GitHub Actions 会自动重新构建并发布 Pages，通常几十秒到几分钟后生效。

## 注意事项

- Token 只建议在你自己的设备上使用
- 如果你勾选记住 Token，它只会保存在当前浏览器本地存储中，不会写进仓库
- 如果修改后页面暂时没更新，先去仓库的 `Actions` 页看部署是否还在进行
- 如果默认分支不是 `main` 或 `master`，记得同步修改 `.github/workflows/deploy.yml`
