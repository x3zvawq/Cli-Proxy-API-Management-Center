# Cli-Proxy-API-Management-Center

此仓库是 x3zvawq 维护的官方 router-for-me 管理面板 fork，并保留有价值的 Fwindy 改动。当前监控中心、账号管理和模型价格由 [CPA QoL](https://github.com/x3zvawq/Cli-Proxy-API-Plugin-QoL) 提供服务端聚合与分页。最新上下文功能见 [使用说明](docs/CONTEXT_VIEWER.md)，上游同步约定见 [分支说明](docs/QOL_UPSTREAM.md)。以下保留 Fwindy 的历史功能说明；[旧监控面板文档](MONITOR-FORK.md) 描述的是迁移前版本。

> 本仓库为上游 Web UI 项目的二次开发版本。
>
> 原始/基础功能请参考上游仓库：https://github.com/router-for-me/Cli-Proxy-API-Management-Center

> [!IMPORTANT]
> 兼容说明：官方 CPA 已移除使用统计 API。
>
> 当前「监控中心」轻量目录与账号测试功能需要 CPA QoL `0.1.0-rc.8` 或更新版本：
> https://github.com/x3zvawq/Cli-Proxy-API-Plugin-QoL

本 README 只记录 **本 fork 相对上游新增/增强的功能点**。

## 本 fork 新增/增强功能

### 新增监控中心页面

- 类似于使用统计界面，但界面美化&增强。
  - 新增「花费与Token」趋势图。
  - 新增「模型使用分布」统计。

- 增强凭证统计
  - 新增凭证花费统计
  - 对于Codex凭证：可一键刷新配额，并根据配额的截止时间往前倒推统计5h花费/周花费。

- 增强请求事件明细：
  - 支持自动刷新（15s/30s/1m/5m）
  - 新增Tokens per second (TPS) 统计
  - 新增首字延迟统计
  - 点击每行前方的减号图标可以删除记录
  - 新增缓存命中率统计
  - 当请求失败时，可点击“失败”查看失败日志（实际上是该凭证的最新状态日志，非精确的请求日志）。

- 一键导入模型价格
  - 从 https://models.dev/api.json 拉取最新价格并导入，对于多Provider的模型，可以手动指定优先用哪个Provider的价格
  - 仅对 **已有使用记录** 的模型进行匹配与同步
  - 支持CPA模型名称映射，例如把CPA中的coder-model先映射为qwen3.6-plus后再进行价格匹配

### 新增凭证中心页面

- Codex 凭证池统计
  - 支持「刷新全部」「刷新未获取」两个批量刷新入口，可设置刷新间隔秒数，并显示批量刷新进度。
  - 展示 7天预估总额度、7天预估剩余额度，以及 Codex 凭证数和未获取额度数量。
  - 按 Codex 类别展示凭证数、已获取额度数、7天预估总额度、7天预估剩余额度、单凭证7天平均额度。
  - 按固定百分比分档展示各凭证的 7 天配额剩余情况，适合大量凭证快速观察分布。

- Antigravity 凭证额度
  - 按 Claude / Gemini 模型分组展示 Antigravity 凭证的剩余额度百分比与配额重置时间。
  - 结合已导入的模型价格估算各分组的剩余可用花费。

## 使用方法

在CPA的配置面板中，设置面板仓库为本仓库地址后，强制刷新（Ctrl+F5）页面

## 友链

[![友链 linux.do](https://img.shields.io/badge/LINUX--DO-Community-blue.svg)](https://linux.do/)

## License

MIT
