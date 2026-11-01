# 汉化模组下载中心  
为Spaceflight-Simulator中国玩家打造  
网站https://sfszhmod.pages.dev/

---

## 公告横幅（data/announce.json）

页面顶部那条吸顶横幅，全部由 `data/announce.json` 控制，改完刷新就能看到（缓存 60 秒）。

```json
{
  "banner": {
    "enabled": true,
    "id": "2026-11-sponsor",
    "type": "sponsor",
    "tag": "公告",
    "text": "横幅上显示的一句话",
    "linkText": "支持一下",
    "action": "sponsor",
    "url": "",
    "closable": true,
    "startAt": "2026-11-01",
    "endAt": ""
  },
  "items": [
    { "type": "info", "title": "公告标题", "content": "公告正文", "date": "2026-11-01" }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `enabled` | `false` 直接关掉横幅 |
| `id` | 公告的唯一编号。**换内容一定要换 id**，否则关了横幅的人看不到新公告 |
| `type` | `info` 黑 / `success` 绿 / `warn` 橙 / `error` 红 / `sponsor` 渐变 |
| `text` | 横幅文字，太长会自动省略号 |
| `linkText` | 右侧按钮文字，留空则不显示按钮 |
| `action` | 点按钮干嘛：`sponsor` 打开赞助窗口 / `url` 打开 `url` / 留空打开公告栏 |
| `startAt` / `endAt` | 生效时间，格式 `2026-11-01` 或 `2026-11-01T10:00:00+08:00`，留空表示不限 |
| `items` | 右侧公告栏里的历史公告，`type` 多一个 `sponsor` |

> 老格式（顶层直接是数组）仍然兼容，只是没有横幅。

## 赞助配置（data/sponsor.json）

右下角「赞助」按钮和弹窗的内容都在这里，改文案、改档位、加赞助者都不用动代码。

```json
{
  "tiers": [
    { "amount": 0.01, "title": "一分钱" },
    { "amount": 0.1, "title": "一毛" },
    { "amount": 0.5, "title": "五毛" },
    { "amount": 1, "title": "一块" },
    { "amount": 2, "title": "两块" },
    { "amount": 5, "title": "五块" }
  ],
  "tierNote": "扫码后自己填金额，多少都是心意。",
  "links": [],
  "qrcodes": [{ "label": "微信扫码 · 金额自填", "img": "图片地址" }],
  "wall": [{ "name": "某位玩家", "amount": 5 }]
}
```

- 所有档位金额都小于 10 时自动排成六宫格（现在的配置就是），大额档位仍然走竖排卡片
- `goal` 是可选的：不写就不显示进度条；写了才显示本月进度（`target` 为 0 也不显示）。想公开筹款目标再填，不想透露金额就留空
- `links` 填了 `url` 才会出现按钮；现在是空的，只留微信收款码一个渠道
- `wall` 就是赞助者墙，没有内容时显示 `wallEmptyText`
- `tierNote` 会显示在档位下面，用来写「金额自填」这类说明

## 前端构建

`app.min.js` / `style.min.css` 是构建产物，改完 `app.js` 或 `style.css` 后执行：

```bash
python tools/minify.py
```

脚本只用 Python 标准库，会把 JS/CSS 压到原来 65% 左右（不会动模板字符串里的文案）。
压缩完记得把 `index.html` 里引用这两个文件的 `?v=` 换成新的版本号，否则老用户拿到的是缓存。

## 赞助点击统计

`/api/event` 会记录赞助入口的点击（`sponsor_open` / `sponsor_click` / `sponsor_qr` / `banner_click`），
浏览器直接打开 `https://你的域名/api/event` 就能看到各事件累计次数，用来判断入口有没有效果。
浏览器控制台里 sendBeacon 打不开页面，只会静默失败，不影响任何功能。

