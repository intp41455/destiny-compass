# 命理罗盘 (Destiny Compass) — 系统设计规范

> 创建日期：2026-08-21
> 状态：待用户审查

## 1. 项目概述

### 1.1 目标

构建一个本地个人使用的全术数命理分析系统。用户输入生日、出生地、性别后，系统按真太阳时校准，调用5种术数排盘引擎（八字、紫微斗数、印度占星、古典占星、阿拉伯占星），结合RAG知识库和多源外部搜索，生成跨术数综合人生分析，以及事件级精确的近期运势预测（逐日/逐月/逐年）。

### 1.2 核心用户流程

1. 用户在前端输入：出生日期（公历）、出生时间、性别、出生地
2. 系统校准真太阳时
3. 并行调用5种术数排盘MCP，生成标准化命盘JSON
4. 从排盘结果提取特征标签，检索RAG知识库 + 外部搜索补充
5. LLM分术数解读 → 跨术数综合人生总论 → 近期运势概述
6. **事件级运势精细化**：逐日（30天）、逐月（12月）、逐年（3年）精确预测
7. SSE流式推送到前端，渐进渲染

### 1.3 设计决策摘要

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 架构路径 | 方案B：细粒度MCP（8个独立服务） | 每种术数独立部署/替换，灵活度最高 |
| 排盘引擎 | 接入开源排盘库 | 性价比最高，避免从头实现天文算法 |
| RAG知识库 | 混合方案：种子库 + 在线搜索 + 用户可扩展 | 兼顾准确性与覆盖面 |
| 部署场景 | 本地个人使用，预留多租户扩展 | 聚焦开发，代码结构留扩展点 |
| LLM方案 | 可配置API适配器 | 支持OpenAI/Anthropic/国内模型/Ollama |

## 2. 系统架构

### 2.1 整体架构

前后分离 + 8个细粒度MCP服务 + 1个编排层。

```
用户输入
  ↓
前端 React SPA (Vite)
  ↓ REST / SSE
核心编排层 (Fastify, Node.js)
  ↓ 并行/串行调度
┌─────────────────────────────────────────────────┐
│ MCP 服务层（8个独立进程，各监听独立端口）          │
│                                                   │
│ 排盘群（共享天文算法库：真太阳时·Swiss Ephemeris）：│
│   MCP-1 八字    MCP-2 紫微    MCP-3 印度          │
│   MCP-4 西洋    MCP-5 阿拉伯                       │
│                                                   │
│ AI能力群：                                         │
│   MCP-6 RAG知识库   MCP-7 多源搜索   MCP-8 LLM网关 │
└─────────────────────────────────────────────────┘
```

### 2.2 MCP服务清单

| MCP | 名称 | 端口 | 职责 | 开源库依赖 |
|-----|------|------|------|-----------|
| MCP-1 | 八字排盘 | 3011 | 四柱·十神·大运·流年·流月·流日·神煞·纳音 | lunar-javascript / sxtwl |
| MCP-2 | 紫微斗数排盘 | 3012 | 命身宫·十二宫·主星辅星·四化·大限·流年流月流日 | iztro / 自研紫微库 |
| MCP-3 | 印度占星排盘 | 3013 | Rashi·Lagna·Nakshatra·Dashas·Yoga·Ashtakavarga·Gochara | swisseph + vedic-astrology |
| MCP-4 | 古典占星排盘 | 3014 | 行星星座宫位·相位·尊贵(essential/accidental)·Firdaria·Profection·Transit | swisseph + astronomy-engine |
| MCP-5 | 阿拉伯占星排盘 | 3015 | Arabic Parts/Lots·月亮南北交·时主星·日主月主 | swisseph (复用) |
| MCP-6 | RAG知识库 | 3016 | Chroma向量库·种子知识·自定义文档·Top-K召回·Rerank·相似命例检索 | chromadb + sentence-transformers |
| MCP-7 | 多源搜索 | 3017 | 维基百科API·GitHub搜索·浏览器搜索兜底·结果去重摘要 | wikipedia API + github API |
| MCP-8 | LLM网关 | 3018 | OpenAI/Anthropic/国内模型/Ollama·Prompt模板管理·流式输出 | openai sdk / anthropic sdk |

### 2.3 共享基础设施

MCP-1 至 MCP-5 共享以下天文/时间计算库（以npm包或Python模块形式引入，非独立服务）：

- **真太阳时换算**：经度时差 + 均时差(Equation of Time)
- **Swiss Ephemeris 星历表**：行星精确位置计算（印度/西洋/阿拉伯共用）
- **经纬度查表**：出生地名称 → 经纬度坐标（内置城市数据库 + 地理编码API兜底）
- **节气计算**：二十四节气精确时刻（八字排盘依赖）

### 2.4 编排层职责

编排层(Fastify)是系统唯一的"大脑"，所有业务流程在此定义：

1. 输入校验（日期合法性、出生地解析、缺失数据兜底提示）
2. 真太阳时校准调度
3. 并行调用5个排盘MCP
4. 排盘结果统一Schema校验
5. 特征标签提取 → RAG查询构造
6. 并行调用RAG召回 + 外部搜索
7. 召回结果去重 + Rerank
8. LLM Prompt编排（分术数解读 → 总论 → 运势 → 精细化运势）
9. SSE流式事件推送
10. 结果缓存 + 历史记录持久化

## 3. 分析流水线

### 3.1 完整流水线（5阶段15步）

#### 阶段1：输入与时间校准

| 步骤 | 名称 | 说明 |
|------|------|------|
| STEP 1 | 真太阳时换算 | 根据出生地经纬度计算经度时差，叠加均时差(Equation of Time)，得到真太阳时 |
| STEP 2 | 边界校验 | 节气交界日期(±2小时)标黄警告，同时排出"交界前/交界后"两盘供切换；缺失数据兜底提示 |

#### 阶段2：5种术数并行排盘（调用 MCP-1~5）

| 步骤 | 名称 | 说明 |
|------|------|------|
| STEP 3 | 并行排盘 | 5个排盘MCP并行执行，各自输出标准化命盘JSON子结构 |
| STEP 4 | 结果统一 | 排盘结果统一为 ChartsResult Schema，提取跨术数汇总特征标签 unified_tags[] |

#### 阶段3：RAG召回 + 外部搜索（调用 MCP-6~7）

| 步骤 | 名称 | 说明 |
|------|------|------|
| STEP 5 | 查询构造 | 从排盘 tags 提取10-20个关键命盘特征作为检索查询 |
| STEP 6 | 向量库检索 | Chroma检索Top-K命例/断语/条文（种子知识库） |
| STEP 7 | 外部搜索补充 | 维基API + GitHub搜索 + 浏览器搜索兜底 |
| STEP 8 | 去重+Rerank | 召回结果跨源去重，按相关性重排 |

#### 阶段4：LLM综合分析（调用 MCP-8）

| 步骤 | 名称 | 说明 |
|------|------|------|
| STEP 9 | 分术数解读 | 按5种术数分别生成专业分析（结合RAG片段） |
| STEP 10 | 人生总论 | 5种术数交叉印证，消弭分歧，性格/事业/感情综合 |
| STEP 11 | 近期运势概述 | 未来3/6/12个月的事业/情感/健康/财运/人际概览 |
| STEP 12 | 注意事项 | 风险提示、颜色/数字建议、行事建议 |

#### 阶段5：事件级精确运势预测（调用 MCP-8 + MCP-6 交叉验证）

| 步骤 | 名称 | 说明 |
|------|------|------|
| STEP 13 | 每日运势 | 未来30天逐日预测：具体事件、遇见的人类型、避忌事项、吉凶时段、健康提示 |
| STEP 14 | 每月运势 | 未来12个月逐月预测：关键日期、转折点、事业节点、桃花/感情事件、潜在冲突、重要人物类型 |
| STEP 15 | 年度运势 | 今年+未来2年：大事件(升迁/搬迁/婚恋)、里程碑、风险预警、机遇窗口、关键人物出现时间 |

### 3.2 阶段5详细设计

**设计原则**：不做笼统描述，预测精确到事件类型和人物类型级别。不确定事件标注概率区间（高/中/低），不做绝对断言。各术数分歧处明确标注。

**STEP 13 每日运势推算依据**：
- 八字流日（日柱天干地支与日主关系）
- 紫微流日（流日宫位+星曜四化）
- 印度Gochara日运（过运行星与 natal 星盘关系）
- 西洋Transit日运（行运星与本命星相位）
- 阿拉伯时主星（ planetary day/lord + planetary hour）

**每日输出格式**：
```
{
  date: "2026-08-22",
  overall: { score: 78, level: "中吉" },
  events: [
    { type: "事业", desc: "可能有重要的沟通/谈判机会", probability: "中", time_slot: "14:00-16:00" },
    { type: "人际", desc: "可能遇到属龙或名字带'水'偏旁的人", probability: "低" }
  ],
  avoid: ["签合同(冲日主)", "远行(流日煞方)"],
  lucky_hours: ["09:00-11:00", "19:00-21:00"],
  health: "注意肠胃，饮食宜清淡",
  cross_check: { bazi: "流日丙火生身", vedic: "Moon transit 5th house", consensus: "高" }
}
```

**STEP 14 每月运势推算依据**：
- 八字流月（月柱天干地支与日主关系）+ 大运交互
- 紫微流月 + 月限宫位
- 印度 Dasha → AntarDasha（大运→次运周期）
- 西洋月Profection + 月Firdaria主星

**每月输出格式**：
```
{
  month: "2026-09",
  theme: "压力与突破并存",
  overall_score: 72,
  key_dates: [
    { date: "09-08", event: "事业转折点，可能有晋升/项目确认", probability: "中", source: ["八字流月官星", "西洋Profection 10宫"] },
    { date: "09-15", event: "感情波动，可能与伴侣争执", probability: "中", source: ["紫微流月桃花宫化忌"] }
  ],
  person_types: ["年长女性(印星)", "南方来的合作者(财星方向)"],
  risk: { area: "财务", desc: "冲动消费或意外支出", level: "中" },
  consensus: { agreement_rate: 0.80, divergences: ["八字看健康不利 / 印度看事业有利"] }
}
```

**STEP 15 年度运势推算依据**：
- 八字大运 + 流年太岁（与日主关系、刑冲合害）
- 紫微大限 + 流年（命宫/财帛/官禄三方四正）
- 印度 MahaDasha（大周期 6-20年）+ AntarDasha
- 西洋年Profection（年主星）+ Solar Return（太阳返照盘）

**年度输出格式**：
```
{
  year: "2026",
  age: 31,
  major_theme: "事业破局年",
  milestones: [
    { period: "Q1", event: "可能获得重要项目或晋升机会", probability: "中高", sources: ["流年官星", "Profection 10宫", "Dasha 换运"] },
    { period: "Q3", event: "健康需关注，肠胃/呼吸系统", probability: "中", sources: ["大运冲日支", "流年煞方"] }
  ],
  risk_windows: [{ period: "2026-07~08", type: "财务", desc: "投资需谨慎" }],
  opportunity_windows: [{ period: "2026-02~04", type: "事业", desc: "贵人出现窗口" }],
  key_persons: [{ timing: "Q1", type: "属马的男性领导/导师" }],
  multi_system_consensus: 0.85
}
```

## 4. 数据结构

### 4.1 统一排盘输出 Schema

所有5种术数MCP输出以下结构的子集，编排层统一组装：

```typescript
interface ChartsResult {
  meta: {
    birthday: string;          // 公历原始输入
    solar_time_corrected: string; // 真太阳时校准后
    true_solar_offset_min: number; // 校准偏移分钟数
    gender: "male" | "female";
    lat: number; lng: number;
    timezone: string;
    location_name: string;
  };
  bazi: {
    pillars: { year: string; month: string; day: string; hour: string };
    day_master: string;       // 日主天干
    ten_gods: Record<string, string[]>;
    hidden_stems: Record<string, string[]>;
    nayin: string;
    dayun: { start_age: number; stems: string[] }[];
    liunian: string[];        // 流年天干地支
    liuyue: string[];
    liuri: string[];
    shensha: string[];
    tags: string[];           // 如 ["丁火日主", "身强", "官印相生"]
  };
  ziwei: {
    palace_map: Record<string, { stars: string[]; sihua?: string[] }>;
    main_stars: string[];
    daxian: { start_age: number; palace: string }[];
    liunian_palace: string;
    liuyue_palace: string;
    tags: string[];
  };
  vedic: {
    rashi: Record<string, string>;
    lagna: string;
    nakshatra: string;
    dasha: { lord: string; start: string; end: string; antar: { lord: string; start: string; end: string }[] }[];
    yogas: string[];
    ashtakavarga: Record<string, number>;
    gochara: Record<string, string>; // 当前行运星位置
    tags: string[];
  };
  western: {
    planets: Record<string, { sign: string; house: number; dignities: string[] }>;
    aspects: { planet1: string; planet2: string; type: string }[];
    firdaria: { period: string; lord: string; sublord: string };
    profection: { year_sign: string; lord: string };
    transits: Record<string, string>;
    tags: string[];
  };
  arabic: {
    lots: Record<string, { degrees: number; house: number }>;
    nodes: { north: string; south: string };
    planetary_day: string;
    planetary_hour: string;
    tags: string[];
  };
  unified_tags: string[];     // 跨术数汇总查询标签
}
```

### 4.2 RAG知识库 Schema

```typescript
interface KnowledgeDoc {
  id: string;
  source: "seed" | "wikipedia" | "github" | "web" | "user_upload";
  system: "bazi" | "ziwei" | "vedic" | "western" | "arabic" | "cross";
  title: string;
  content: string;           // 切分后的文本块
  tags: string[];            // 命理特征标签，用于精确匹配
  case_refs?: {              // 历史命例引用
    birth_profile: string;
    outcome: string;
    confidence: number;
  };
  embedding?: number[];
}
```

### 4.3 运势预测输出 Schema

```typescript
interface FortuneReport {
  analysis_id: string;
  created_at: string;
  meta: ChartsResult["meta"];
  daily: DailyFortune[];      // STEP 13 输出
  monthly: MonthlyFortune[];   // STEP 14 输出
  yearly: YearlyFortune[];     // STEP 15 输出
  llm_usage: { model: string; tokens: number };
}

interface DailyFortune {
  date: string;
  overall: { score: number; level: string };
  events: { type: string; desc: string; probability: "高" | "中" | "低"; time_slot?: string }[];
  avoid: string[];
  lucky_hours: string[];
  health: string;
  cross_check: { bazi: string; vedic: string; western: string; consensus: string };
}

interface MonthlyFortune {
  month: string;
  theme: string;
  overall_score: number;
  key_dates: { date: string; event: string; probability: string; source: string[] }[];
  person_types: string[];
  risk: { area: string; desc: string; level: string };
  consensus: { agreement_rate: number; divergences: string[] };
}

interface YearlyFortune {
  year: string;
  age: number;
  major_theme: string;
  milestones: { period: string; event: string; probability: string; sources: string[] }[];
  risk_windows: { period: string; type: string; desc: string }[];
  opportunity_windows: { period: string; type: string; desc: string }[];
  key_persons: { timing: string; type: string }[];
  multi_system_consensus: number;
}
```

## 5. API 设计

### 5.1 编排层 REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/analyze` | 接收输入参数，返回 `analysis_id`，后续通过SSE推送结果 |
| GET | `/api/stream/:id` | SSE流式推送分析进度和结果（分模块渐进） |
| GET | `/api/history` | 历史分析列表 |
| GET | `/api/history/:id` | 查看过往报告 |
| DELETE | `/api/history/:id` | 删除报告 |
| GET | `/api/status` | MCP服务健康状态 + LLM配置状态 |

### 5.2 SSE 事件类型

```
event: progress    data: {"step": "STEP 3", "message": "排盘中... 八字完成"}
event: charts      data: {ChartsResult JSON}
event: rag         data: {"retrieved": 12, "sources": ["seed", "wikipedia"]}
event: analysis    data: {"section": "总论", "content": "..."}
event: fortune     data: {"type": "daily", "data": DailyFortune}
event: done        data: {"analysis_id": "...", "tokens": 12308}
event: error       data: {"step": "...", "message": "..."}
```

### 5.3 MCP 间通信协议

统一 REST over HTTP，每个MCP监听独立端口：

- MCP-1~5: `POST /paipan`（参数：meta + 真太阳时）, `POST /validate-time`
- MCP-6: `POST /rag/query`, `POST /rag/ingest`
- MCP-7: `POST /search/wikipedia`, `POST /search/github`, `POST /search/web`
- MCP-8: `POST /llm/chat`（参数：model, messages, temperature, stream）

## 6. 前端设计

### 6.1 布局

左右两栏布局：
- **左侧栏（340px）**：排盘输入表单（生日/时间/性别/出生地/时区）+ 真太阳时校准提示 + MCP服务状态卡片
- **右侧栏**：命盘总览Tab（综合/八字/紫微/印度/西洋/阿拉伯）+ 5术数mini排盘卡片 + 三大分析板块（人生总论/近期运势/注意事项）+ 运势日历视图

### 6.2 运势日历视图

阶段5的输出在前端以交互式日历呈现：
- **日历视图**：30天网格，每日卡片显示吉凶色块+事件图标，点击展开详情
- **月历视图**：12月时间轴，每月卡片含主题+关键日期标注+风险色块
- **年度时间轴**：3年横向时间轴，标注里程碑/风险区间/机遇窗口

### 6.3 流式加载

SSE推送时前端渐进渲染：
- 排盘完成 → 渲染5术数mini卡片
- RAG完成 → 显示来源标签
- 总论完成 → 渲染总论卡片
- 运势完成 → 逐日/逐月/逐年卡片渐进出现
- 加载中 → skeleton占位 + shimmer动画

## 7. 错误处理与降级策略

| 场景 | 处理方式 |
|------|----------|
| 出生地无法匹配经纬度 | 提示用户手动输入经纬度；无法解析则阻塞不允许提交 |
| 节气交界日期(±2小时) | 标黄警告 + 同时排出"交界前/交界后"两盘供切换 |
| Swiss Ephemeris 星历缺失 | 回退到近似算法（带精度降级标签），不阻塞 |
| 开源排盘库缺失某术数实现 | 该术数Tab显示"排盘引擎建设中"占位 + 其余4术数正常综合 |
| 向量库空（首次启动） | 仅用种子知识 + 在线搜索，向量检索跳过但不报错 |
| 维基/GitHub/浏览器搜索失败 | 逐个降级，最终回落到种子库；前端显示"外部搜索不可用" |
| LLM 调用失败/限流 | 自动切换备用模型（配置列表内按优先级尝试），3次失败后展示模板化基础解读 |
| 某术数RAG结果不足3条 | 在报告中标注"参考样本较少，可信度一般"，不编造 |
| 排盘MCP某服务离线 | 该术数标记"服务不可用"，其余术数继续分析，总论中标注缺失 |
| 运势预测多术数分歧 | 明确标注"八字认为X / 西洋认为Y"，取加权共识，不隐瞒分歧 |

## 8. 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | React 19 + Vite + TypeScript | SPA，SSE流式渲染，日历交互组件 |
| 前端UI | Tailwind CSS + shadcn/ui | 组件库，暗色模式支持 |
| 编排层 | Node.js + Fastify + TypeScript | REST + SSE，MCP调度，缓存 |
| MCP排盘 | Python (FastAPI) 或 Node.js | MCP-1~5各自独立，共享天文库 |
| 向量库 | ChromaDB + sentence-transformers | 本地部署，无云依赖 |
| LLM | OpenAI/Anthropic SDK + Ollama | 可配置适配器，支持流式 |
| 容器化 | Docker Compose | 8 MCP + 编排层 + 前端，一键启动 |
| 持久化 | SQLite | 历史记录、配置、缓存 |

## 9. 项目结构

```
destiny-compass/
├── docker-compose.yml          # 一键启动所有服务
├── orchestrator/               # 编排层 (Fastify)
│   ├── src/
│   │   ├── routes/             # REST + SSE 路由
│   │   ├── pipeline/          # 分析流水线编排
│   │   ├── mcp-client/        # MCP 调用客户端
│   │   └── config/            # LLM Key、MCP端口配置
│   └── package.json
├── mcp-bazi/                   # MCP-1 八字排盘
├── mcp-ziwei/                  # MCP-2 紫微斗数排盘
├── mcp-vedic/                  # MCP-3 印度占星排盘
├── mcp-western/                # MCP-4 古典占星排盘
├── mcp-arabic/                 # MCP-5 阿拉伯占星排盘
├── mcp-rag/                    # MCP-6 RAG知识库
├── mcp-search/                 # MCP-7 多源搜索
├── mcp-llm/                    # MCP-8 LLM网关
├── shared/                     # 共享天文算法库
│   ├── solar-time/            # 真太阳时换算
│   ├── ephemeris/             # Swiss Ephemeris 封装
│   ├── geo-coding/            # 经纬度查表
│   └── schemas/               # 统一 TypeScript/JSON Schema
├── knowledge-seed/             # 种子知识库文档（Markdown）
│   ├── bazi/                  # 八字基础术语、断语
│   ├── ziwei/                 # 紫微星系含义
│   ├── vedic/                 # 印度占星概念
│   ├── western/               # 古典占星规则
│   └── arabic/                # 阿拉伯占星知识
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/        # 排盘卡片、运势日历等
│   │   ├── hooks/             # SSE流式 hook
│   │   └── api/               # API 客户端
│   └── package.json
└── docs/                       # 文档
    └── superpowers/specs/     # 设计规范
```

## 10. 未来扩展点

- **多租户**：编排层预留 user_id 字段，SQLite → PostgreSQL 迁移
- **排盘MCP拆分**：MCP-1内部可按术数再拆出独立MCP，接口契约不变
- **知识库扩充**：用户上传自定义命理文档 → MCP-6 /rag/ingest 入库
- **新术数接入**：新增 MCP-9（如奇门遁甲），编排层注册即可
- **模型升级**：LLM网关配置列表新增模型，无需改代码
- **运势精度提升**：种子知识库持续扩充历史命例，RAG召回精度提升