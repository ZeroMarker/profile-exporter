# Profile Exporter

Chrome 扩展，一键导出你在各社交平台的关注列表、点赞和收藏数据。

## 支持平台

| 平台 | 关注 | 点赞 | 收藏 |
|------|------|------|------|
| **X (Twitter)** | ✓ | ✓ | ✓ (书签) |
| **Instagram** | ✓ | — | ✓ (已保存) |
| **TikTok** | ✓ | ✓ | ✓ |
| **Bilibili** | ✓ | — | ✓ |
| **YouTube** | ✓ (订阅) | — | ✓ (稍后观看) |
| **Weibo (微博)** | ✓ | ✓ | ✓ |
| **Xiaohongshu (小红书)** | ✓ | ✓ | ✓ (收藏夹) |
| **Douyin (抖音)** | ✓ | ✓ | ✓ |

## 安装

1. 下载 [Releases](https://github.com/ZeroMarker/profile-exporter/releases) 中的 `profile-exporter.zip`
2. 解压文件
3. 打开 `chrome://extensions` → 开启「开发者模式」
4. 点击「加载已解压的扩展程序」→ 选择解压后的文件夹

## 使用方法

1. 在浏览器中登录对应平台
2. 点击扩展图标，选择平台和要导出的类别
3. 选择导出格式（JSON / CSV），设置最大条数
4. 点击 **Export**

### 小红书 / 抖音 注意事项

这两个平台需要通过页面注入方式获取数据：

- 使用前请确保已在浏览器中登录对应平台
- 建议先访问个人主页，再执行导出

## 导出数据格式

### JSON 示例

```json
{
  "platform": "weibo",
  "category": "following",
  "exported_at": "2026-07-08T09:00:00.000Z",
  "count": 2,
  "items": [
    {
      "id": "1234567890",
      "username": "example_user",
      "name": "示例用户",
      "url": "https://weibo.com/u/1234567890",
      "avatar_url": "https://..."
    }
  ]
}
```

### CSV 格式

导出为标准 CSV，包含 `id`, `username`, `name`, `url`, `avatar_url` 列。

## 技术架构

- **Manifest V3** Chrome 扩展
- 各平台独立模块化实现（`platforms/` 目录）
- 共享工具库：HTTP 请求重试、分页、Cookie 管理（`utils/`）
- 小红书 / 抖音通过 content script + 页面注入脚本桥接 API 签名

## 开发

```bash
# 验证 manifest
node -e "JSON.parse(require('fs').readFileSync('manifest.json'))"

# 检查 JS 语法
node -c platforms/*.js background/*.js popup/popup.js utils/*.js
```

## License

MIT
