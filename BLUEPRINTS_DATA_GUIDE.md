# 模组配套蓝图数据填写说明

站点通过 [`data/blueprints.json`](data/blueprints.json) 读取并渲染“配套蓝图”页面。新增蓝图时，请将 [`data/blueprints.template.json`](data/blueprints.template.json) 中的大括号对象复制到 `blueprints` 数组末尾，并使用英文逗号分隔每条资源。

> `blueprints.json` 必须保持为合法 JSON。请不要添加注释、尾随逗号或未加双引号的字段名。

| 字段 | 是否必填 | 填写方式 | 页面用途 |
|---|---:|---|---|
| `id` | 是 | 全站唯一的小写英文、数字与连字符，例如 `falcon-heavy-v2`。 | 用于卡片与下载前提醒的内部定位。 |
| `name` | 是 | 展示给用户的蓝图名称。 | 卡片标题与下载前确认标题。 |
| `desc` | 建议 | 简述蓝图用途、机型和注意事项。 | 卡片简介。 |
| `link` | 是 | 公开 HTTPS 下载链接。 | 用户确认依赖后在新标签页打开。 |
| `images` | 建议 | 一个或多个公开 HTTPS 图片链接。 | 卡片使用第一张作为预览图。 |
| `tags` | 建议 | 蓝图分类标签数组，例如“配套蓝图”“猎鹰重型”。 | 卡片标签。 |
| `format` | 建议 | 例如“蓝图 ZIP”。 | 卡片文件类型。 |
| `size` | 建议 | 例如 `1.9KB` 或 `2.4MB`。 | 卡片元信息。 |
| `date` | 建议 | 使用 `YYYY-MM-DD`，例如 `2026-08-26`。 | 卡片元信息。 |
| `requirements` | 是 | 所需模组数组；没有依赖时填写空数组 `[]`。 | 下载前依赖提醒。 |
| `requirements[].name` | 有依赖时必填 | 必须与网站模组标题一致，例如“猎鹰九号-V2”。 | “查看模组”会自动搜索此名称。 |
| `requirements[].note` | 建议 | 简短说明安装要求。 | 依赖提醒补充说明。 |

## 可直接复制的新增条目

```json
{
  "id": "next-blueprint-id",
  "name": "新蓝图名称",
  "desc": "蓝图简介与使用说明。",
  "link": "https://你的下载链接",
  "images": [
    "https://你的预览图链接.webp"
  ],
  "tags": [
    "配套蓝图"
  ],
  "format": "蓝图 ZIP",
  "size": "待填写",
  "date": "2026-08-26",
  "requirements": [
    {
      "name": "所需模组名称",
      "note": "需先下载并安装该模组"
    }
  ]
}
```

如果蓝图不需要模组，请保留：

```json
"requirements": []
```
