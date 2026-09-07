# 自用监控面板

基于 Fwindy 的管理前端维护；保留 CPA 和 usage-statistics 插件，不实现计费或修改代理转发。

需要已启用的 usage-statistics 插件和管理密钥。仅展示该插件已经采集的数据，不能补出未记录的历史。浏览器遮蔽 Key 不是权限隔离：管理接口仍会返回原始 Key，仅供管理员使用。

## 使用监控中心

进入 `management.html#/monitor`，点「自定义时间」，选择开始与结束后点「应用时间」。日期按浏览器时区解释，开始包含、结束不包含；非法时间不会提交，输入尚未应用时仍显示旧的生效区间。

- 全局 Key、模型、上游来源和结果筛选作用于概览、趋势、分布、汇总和明细。
- 趋势用曲线展示 Token 或请求次数，以及有价格数据的模型费用；按小时或按天聚合，长区间合并到约 720 点。
- 明细显示脱敏的下游 Key，与上游账号分列；每页 50 条，导出包含全部匹配记录而非当前页。导出字段 `downstream_api_key_masked` 不包含完整密钥。
- 自定义区间的 RPM / TPM 是整个区间的平均值，包括空闲时间。预设「全部时间」保留原来的近 30 分钟 RPM / TPM。
- TTFT P50 / P95 使用最近秩法，只纳入有计时数据的成功请求；无样本显示 `--`。输入、输出、推理、缓存读取和缓存创建分别展示，不能简单相加。
- 费用是当前浏览器模型价格配置的估算值，不是账号实际余额；未配置价格的模型不计入费用。

## 构建和验证

环境：Node.js 24，Bun 1.3.14。从本仓库根目录执行：

```bash
bun install --frozen-lockfile
VERSION=x3zvawq-monitor-20260907 bun run verify
bun tests/fixtures/monitor-preview.ts
```

预览只绑定 `127.0.0.1:4179`，打开 `http://127.0.0.1:4179/management.html#/login`，输入任意非空测试密码。这是合成数据、只读接口，不连接生产账号。预览数据固定在 2026-09-07 浏览器上海时区的 10:00–12:04，使用自定义区间查看；其他时区会相应换算。

2026-09-07 验证证据：452 个测试通过，ESLint / TypeScript / 单文件构建通过。浏览器中 125 条合成记录选取 10:00–11:00 后变为 60 条；第二页为 10 条；选第二个 Key 后整页变为 30 条。390px 窄屏无页面横向溢出。

证据 → 结论 → 调用路径：`tests/monitorDateRangeStore.test.ts` 验证 RFC3339 参数、刷新替换和过期响应隔离；因此无需新增后端接口；调用链为 `MonitoringCenterPage → useUsageData → useUsageStatsStore → usageApi → GET /v0/management/plugins/usage-statistics/usage?start=…&end=…`。页面再按相同边界及维度重建统计快照。

## 发布和回滚

构建产物仍为独立的 `dist/index.html`，发布时命名为 `management.html`。上线前备份服务器的原页面和配置，再替换静态页面；不需要重启 CPA。回滚时还原备份的页面和面板仓库配置，不还原或覆盖持续写入的统计数据库。

服务器应保持 `remote-management.disable-auto-update-panel: true`，面板源设置为本 fork。已移除上游同步工作流的定时触发；手动合并上游后必须重新验证再发布，避免自动覆盖定制功能。

目前接口一次返回所选区间内的全部事件，分页只减少 DOM 渲染量。数据量增长后优先缩小查询时间；后端分页和服务端聚合不在这一版内。
