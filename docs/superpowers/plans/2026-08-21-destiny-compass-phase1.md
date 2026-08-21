# 命理罗盘 Phase 1 实施计划 — 端到端最小闭环

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建项目骨架，打通"输入 → 真太阳时校准 → 八字排盘 → 前端展示"的端到端最小闭环，后续阶段在此基础上逐步接入其余术数和AI能力。

**Architecture:** Monorepo结构，pnpm workspace管理。所有服务统一 TypeScript/Node.js 技术栈。Phase 1 包含：共享库（真太阳时+Schema+地理编码）、MCP-1八字排盘服务、MCP-8 LLM网关（简单透传）、编排层（Fastify+SSE）、前端（React+Vite）。

**Tech Stack:** TypeScript, Node.js, pnpm workspace, Fastify, React 19, Vite, Tailwind CSS, lunar-javascript, Vitest

---

## 文件结构

```
destiny-compass/
├── pnpm-workspace.yaml
├── package.json                    # 根package，scripts统一启动
├── tsconfig.base.json              # 共享TS配置
├── docker-compose.yml             # Phase 2+使用，Phase 1先pnpm dev
├── packages/
│   ├── shared/                     # 共享库
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── schemas/
│   │   │   │   └── charts.ts       # ChartsResult 等类型定义
│   │   │   ├── solar-time/
│   │   │   │   └── index.ts        # 真太阳时换算
│   │   │   ├── geo-coding/
│   │   │   │   └── index.ts        # 城市经纬度查表
│   │   │   └── index.ts            # 统一导出
│   │   └── __tests__/
│   │       ├── solar-time.test.ts
│   │       └── geo-coding.test.ts
│   ├── mcp-bazi/                   # MCP-1 八字排盘
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── server.ts           # Fastify服务
│   │   │   ├── bazi-engine.ts      # 排盘逻辑（lunar-javascript）
│   │   │   └── routes.ts           # POST /paipan, POST /validate-time
│   │   └── __tests__/
│   │       └── bazi-engine.test.ts
│   ├── mcp-llm/                    # MCP-8 LLM网关（简单透传）
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── llm-adapter.ts      # OpenAI兼容适配器
│   │   │   └── routes.ts           # POST /llm/chat
│   │   └── __tests__/
│   │       └── llm-adapter.test.ts
│   ├── orchestrator/              # 编排层
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── server.ts          # Fastify主服务
│   │   │   ├── routes/
│   │   │   │   ├── analyze.ts     # POST /api/analyze
│   │   │   │   ├── stream.ts      # GET /api/stream/:id (SSE)
│   │   │   │   └── status.ts      # GET /api/status
│   │   │   ├── pipeline/
│   │   │   │   └── index.ts       # 分析流水线编排
│   │   │   ├── mcp-client/
│   │   │   │   └── index.ts        # MCP HTTP调用客户端
│   │   │   └── config.ts          # 端口、LLM Key配置
│   │   └── __tests__/
│   │       └── pipeline.test.ts
│   └── frontend/                  # 前端React SPA
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── components/
│           │   ├── InputForm.tsx   # 排盘输入表单
│           │   ├── BaziChart.tsx   # 八字排盘展示
│           │   └── StatusBadge.tsx # MCP状态指示
│           ├── hooks/
│           │   └── useSSE.ts       # SSE流式hook
│           └── api/
│               └── client.ts       # API客户端
└── knowledge-seed/                 # 种子知识（Phase 3使用）
    └── bazi/
        └── basics.md               # 基础术语
```

---

## Task 1: Monorepo 骨架初始化

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`

- [ ] **Step 1: 初始化根package.json**

```bash
cd /workspace && pnpm init
```

修改 `package.json` 内容为：

```json
{
  "name": "destiny-compass",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "dev:frontend": "pnpm --filter frontend dev",
    "dev:orchestrator": "pnpm --filter orchestrator dev",
    "dev:mcp-bazi": "pnpm --filter mcp-bazi dev",
    "dev:mcp-llm": "pnpm --filter mcp-llm dev"
  }
}
```

- [ ] **Step 2: 创建pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: 创建tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 4: 验证工作区初始化**

```bash
pnpm install
```
Expected: 无错误，无packages安装（尚无子包）

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: init monorepo skeleton"
```

---

## Task 2: 共享库 — Schema 类型定义

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/schemas/charts.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: 创建shared包结构**

```bash
mkdir -p packages/shared/src/schemas packages/shared/src/solar-time packages/shared/src/geo-coding
```

- [ ] **Step 2: 创建 packages/shared/package.json**

```json
{
  "name": "@destiny/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 3: 创建 packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 编写 ChartsResult 类型定义**

创建 `packages/shared/src/schemas/charts.ts`：

```typescript
/** 排盘输入参数 */
export interface PaipanInput {
  birthday: string;       // 公历日期 YYYY-MM-DD
  birthTime: string;      // 出生时间 HH:MM
  gender: "male" | "female";
  locationName: string;   // 出生地名称
  lat?: number;           // 可选手动指定纬度
  lng?: number;           // 可选手动指定经度
  timezone?: string;      // 可选，默认从经度推断
}

/** 真太阳时校准结果 */
export interface SolarTimeResult {
  inputTime: string;           // 原始输入时间
  solarTime: string;           // 校准后真太阳时
  offsetMinutes: number;       // 校准偏移分钟数
  lng: number;
  lat: number;
  locationName: string;
  longitudeDiffMinutes: number; // 经度时差分钟
  equationOfTimeMinutes: number; // 均时差分钟
}

/** 八字排盘结果 */
export interface BaziResult {
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  dayMaster: string;
  tenGods: Record<string, string>;
  hiddenStems: Record<string, string[]>;
  nayin: string;
  dayun: { startAge: number; stems: string[] }[];
  shensha: string[];
  tags: string[];
}

/** 统一排盘输出 */
export interface ChartsResult {
  meta: {
    birthday: string;
    solarTimeCorrected: string;
    trueSolarOffsetMin: number;
    gender: "male" | "female";
    lat: number;
    lng: number;
    timezone: string;
    locationName: string;
  };
  bazi: BaziResult;
  // 以下术数在后续Phase接入
  ziwei?: unknown;
  vedic?: unknown;
  western?: unknown;
  arabic?: unknown;
  unifiedTags: string[];
}

/** SSE 事件类型 */
export type SSEEvent =
  | { type: "progress"; step: string; message: string }
  | { type: "charts"; data: ChartsResult }
  | { type: "analysis"; section: string; content: string }
  | { type: "done"; analysisId: string; tokens: number }
  | { type: "error"; step: string; message: string };
```

- [ ] **Step 5: 创建统一导出**

创建 `packages/shared/src/index.ts`：

```typescript
export * from "./schemas/charts.js";
export * from "./solar-time/index.js";
export * from "./geo-coding/index.js";
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(shared): add ChartsResult schema types"
```

---

## Task 3: 共享库 — 真太阳时换算

**Files:**
- Create: `packages/shared/src/solar-time/index.ts`
- Create: `packages/shared/__tests__/solar-time.test.ts`

- [ ] **Step 1: 写真太阳时换算测试**

创建 `packages/shared/__tests__/solar-time.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { calculateSolarTime } from "../src/solar-time/index.js";

describe("calculateSolarTime", () => {
  it("北京116.41°E 14:30 应产生约+14分钟偏移", () => {
    const result = calculateSolarTime({
      date: "1995-06-15",
      time: "14:30",
      lng: 116.41,
      lat: 39.90,
      locationName: "北京",
    });
    expect(result.longitudeDiffMinutes).toBeCloseTo(13.64, 1); // (116.41-120)*4 = -14.36, abs≈14.36
    expect(result.solarTime).toContain("14:");
    expect(result.offsetMinutes).toBeGreaterThan(10);
  });

  it("经度120°E应产生0经度时差", () => {
    const result = calculateSolarTime({
      date: "2026-01-01",
      time: "12:00",
      lng: 120,
      lat: 30,
      locationName: "test",
    });
    expect(result.longitudeDiffMinutes).toBeCloseTo(0, 1);
  });

  it("均时差应在-16到+16分钟之间", () => {
    const result = calculateSolarTime({
      date: "2026-06-15",
      time: "12:00",
      lng: 116.41,
      lat: 39.90,
      locationName: "北京",
    });
    expect(Math.abs(result.equationOfTimeMinutes)).toBeLessThanOrEqual(16);
  });

  it("应正确计算总偏移和真太阳时", () => {
    const result = calculateSolarTime({
      date: "2026-03-21",
      time: "10:00",
      lng: 121.47,
      lat: 31.23,
      locationName: "上海",
    });
    expect(result.solarTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(result.inputTime).toBe("2026-03-21 10:00");
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd packages/shared && npx vitest run __tests__/solar-time.test.ts
```
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现真太阳时换算**

创建 `packages/shared/src/solar-time/index.ts`：

```typescript
import type { SolarTimeResult } from "../schemas/charts.js";

interface CalcInput {
  date: string;
  time: string;
  lng: number;
  lat: number;
  locationName: string;
}

/**
 * 均时差 (Equation of Time) 计算
 * 使用简化公式，精度约±0.5分钟
 * 输入：一年中的天数 (0-365)
 * 输出：分钟数（正=太阳快，负=太阳慢）
 */
function equationOfTime(dayOfYear: number): number {
  const B = (2 * Math.PI * (dayOfYear - 81)) / 365;
  const EoT =
    9.87 * Math.sin(2 * B) -
    7.53 * Math.cos(B) -
    1.5 * Math.sin(B);
  return EoT; // 分钟
}

/**
 * 计算一年中的第几天 (0-indexed)
 */
function getDayOfYear(dateStr: string): number {
  const date = new Date(dateStr);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * 真太阳时换算
 *
 * 真太阳时 = 标准时 + 经度时差 + 均时差
 * 经度时差 = (经度 - 标准经度) × 4分钟/度
 * 标准经度 = 时区中央经度（如UTC+8为120°E）
 */
export function calculateSolarTime(input: CalcInput): SolarTimeResult {
  const { date, time, lng, lat, locationName } = input;

  // 标准时区经度：取最接近的15°倍数
  const standardMeridian = Math.round(lng / 15) * 15;

  // 经度时差（分钟）
  const longitudeDiffMinutes = (lng - standardMeridian) * 4;

  // 均时差（分钟）
  const dayOfYear = getDayOfYear(date);
  const eotMinutes = equationOfTime(dayOfYear);

  // 总偏移
  const offsetMinutes = longitudeDiffMinutes + eotMinutes;

  // 计算真太阳时
  const [hours, minutes] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + offsetMinutes;

  const solarHours = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
  const solarMinutes = Math.floor(((totalMinutes % 60) + 60) % 60);

  const solarTimeStr = `${date} ${String(solarHours).padStart(2, "0")}:${String(solarMinutes).padStart(2, "0")}`;
  const inputTimeStr = `${date} ${time}`;

  // 时区字符串
  const timezoneOffset = Math.round(lng / 15);
  const timezone = timezoneOffset >= 0 ? `UTC+${timezoneOffset}` : `UTC${timezoneOffset}`;

  return {
    inputTime: inputTimeStr,
    solarTime: solarTimeStr,
    offsetMinutes: Math.round(offsetMinutes * 100) / 100,
    lng,
    lat,
    locationName,
    longitudeDiffMinutes: Math.round(longitudeDiffMinutes * 100) / 100,
    equationOfTimeMinutes: Math.round(eotMinutes * 100) / 100,
  } as SolarTimeResult & { timezone: string };
}

// 补充 timezone 字段到返回值
// （通过类型断言在上面已处理，但为了类型安全，这里修改接口）
```

修正返回类型——在 `charts.ts` 的 `SolarTimeResult` 中添加 `timezone` 字段（如果上述类型没有的话）。实际上上面已通过 `as SolarTimeResult & { timezone: string }` 处理。但为了干净，编辑 `SolarTimeResult` 加上 `timezone: string`：

在 `packages/shared/src/schemas/charts.ts` 的 `SolarTimeResult` 中追加字段：

```typescript
  timezone: string;
```

并修正 `index.ts` 中的返回值，去掉类型断言 hack：

```typescript
  return {
    inputTime: inputTimeStr,
    solarTime: solarTimeStr,
    offsetMinutes: Math.round(offsetMinutes * 100) / 100,
    lng,
    lat,
    locationName,
    longitudeDiffMinutes: Math.round(longitudeDiffMinutes * 100) / 100,
    equationOfTimeMinutes: Math.round(eotMinutes * 100) / 100,
    timezone,
  };
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd packages/shared && npx vitest run __tests__/solar-time.test.ts
```
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shared): add solar time calculation with EoT"
```

---

## Task 4: 共享库 — 地理编码（城市经纬度查表）

**Files:**
- Create: `packages/shared/src/geo-coding/index.ts`
- Create: `packages/shared/__tests__/geo-coding.test.ts`

- [ ] **Step 1: 写地理编码测试**

创建 `packages/shared/__tests__/geo-coding.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { geocode, CITY_DATABASE } from "../src/geo-coding/index.js";

describe("geocode", () => {
  it("应返回北京的经纬度", () => {
    const result = geocode("北京");
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(39.90, 1);
    expect(result!.lng).toBeCloseTo(116.41, 1);
  });

  it("应支持省市格式 '北京市'", () => {
    const result = geocode("北京市");
    expect(result).not.toBeNull();
    expect(result!.lng).toBeCloseTo(116.41, 1);
  });

  it("应支持上海", () => {
    const result = geocode("上海");
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(31.23, 1);
  });

  it("未知城市应返回null", () => {
    const result = geocode("火星城");
    expect(result).toBeNull();
  });

  it("CITY_DATABASE应包含至少50个城市", () => {
    expect(Object.keys(CITY_DATABASE).length).toBeGreaterThanOrEqual(50);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd packages/shared && npx vitest run __tests__/geo-coding.test.ts
```
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现城市经纬度数据库**

创建 `packages/shared/src/geo-coding/index.ts`：

```typescript
export interface GeoLocation {
  lat: number;
  lng: number;
  cityName: string;
  province: string;
}

// 中国主要城市 + 全球主要城市经纬度
export const CITY_DATABASE: Record<string, GeoLocation> = {
  // 直辖市
  "北京": { lat: 39.9042, lng: 116.4074, cityName: "北京", province: "北京市" },
  "北京市": { lat: 39.9042, lng: 116.4074, cityName: "北京", province: "北京市" },
  "上海": { lat: 31.2304, lng: 121.4737, cityName: "上海", province: "上海市" },
  "上海市": { lat: 31.2304, lng: 121.4737, cityName: "上海", province: "上海市" },
  "天津": { lat: 39.0842, lng: 117.2009, cityName: "天津", province: "天津市" },
  "天津市": { lat: 39.0842, lng: 117.2009, cityName: "天津", province: "天津市" },
  "重庆": { lat: 29.5630, lng: 106.5516, cityName: "重庆", province: "重庆市" },
  "重庆市": { lat: 29.5630, lng: 106.5516, cityName: "重庆", province: "重庆市" },

  // 广东省
  "广州": { lat: 23.1291, lng: 113.2644, cityName: "广州", province: "广东省" },
  "广州市": { lat: 23.1291, lng: 113.2644, cityName: "广州", province: "广东省" },
  "深圳": { lat: 22.5431, lng: 114.0579, cityName: "深圳", province: "广东省" },
  "深圳市": { lat: 22.5431, lng: 114.0579, cityName: "深圳", province: "广东省" },
  "东莞": { lat: 23.0207, lng: 113.7518, cityName: "东莞", province: "广东省" },
  "佛山": { lat: 23.0218, lng: 113.1219, cityName: "佛山", province: "广东省" },
  "珠海": { lat: 22.2710, lng: 113.5767, cityName: "珠海", province: "广东省" },
  "中山": { lat: 22.5170, lng: 113.3927, cityName: "中山", province: "广东省" },
  "惠州": { lat: 23.1116, lng: 114.4162, cityName: "惠州", province: "广东省" },
  "汕头": { lat: 23.3535, lng: 116.6822, cityName: "汕头", province: "广东省" },

  // 江苏省
  "南京": { lat: 32.0603, lng: 118.7969, cityName: "南京", province: "江苏省" },
  "苏州市": { lat: 31.2989, lng: 120.5853, cityName: "苏州", province: "江苏省" },
  "苏州": { lat: 31.2989, lng: 120.5853, cityName: "苏州", province: "江苏省" },
  "无锡": { lat: 31.4912, lng: 120.3119, cityName: "无锡", province: "江苏省" },
  "常州": { lat: 31.7727, lng: 119.9469, cityName: "常州", province: "江苏省" },
  "徐州": { lat: 34.2654, lng: 117.1847, cityName: "徐州", province: "江苏省" },

  // 浙江省
  "杭州": { lat: 30.2741, lng: 120.1551, cityName: "杭州", province: "浙江省" },
  "杭州市": { lat: 30.2741, lng: 120.1551, cityName: "杭州", province: "浙江省" },
  "宁波": { lat: 29.8683, lng: 121.5440, cityName: "宁波", province: "浙江省" },
  "温州": { lat: 27.9938, lng: 120.6993, cityName: "温州", province: "浙江省" },
  "绍兴": { lat: 30.0026, lng: 120.5800, cityName: "绍兴", province: "浙江省" },

  // 四川省
  "成都": { lat: 30.5728, lng: 104.0668, cityName: "成都", province: "四川省" },
  "成都市": { lat: 30.5728, lng: 104.0668, cityName: "成都", province: "四川省" },

  // 湖北省
  "武汉": { lat: 30.5928, lng: 114.3055, cityName: "武汉", province: "湖北省" },
  "武汉市": { lat: 30.5928, lng: 114.3055, cityName: "武汉", province: "湖北省" },

  // 湖南省
  "长沙": { lat: 28.2278, lng: 112.9388, cityName: "长沙", province: "湖南省" },

  // 陕西省
  "西安": { lat: 34.3416, lng: 108.9398, cityName: "西安", province: "陕西省" },

  // 河南省
  "郑州": { lat: 34.7466, lng: 113.6253, cityName: "郑州", province: "河南省" },
  "洛阳": { lat: 34.6197, lng: 112.4540, cityName: "洛阳", province: "河南省" },

  // 山东省
  "济南": { lat: 36.6512, lng: 117.1201, cityName: "济南", province: "山东省" },
  "青岛": { lat: 36.0671, lng: 120.3826, cityName: "青岛", province: "山东省" },
  "烟台": { lat: 37.4638, lng: 121.4480, cityName: "烟台", province: "山东省" },

  // 福建省
  "福州": { lat: 26.0745, lng: 119.2965, cityName: "福州", province: "福建省" },
  "厦门": { lat: 24.4798, lng: 118.0894, cityName: "厦门", province: "福建省" },

  // 辽宁省
  "沈阳": { lat: 41.8057, lng: 123.4315, cityName: "沈阳", province: "辽宁省" },
  "大连": { lat: 38.9140, lng: 121.6147, cityName: "大连", province: "辽宁省" },

  // 吉林省
  "长春": { lat: 43.8171, lng: 125.3235, cityName: "长春", province: "吉林省" },

  // 黑龙江省
  "哈尔滨": { lat: 45.8038, lng: 126.5350, cityName: "哈尔滨", province: "黑龙江省" },

  // 安徽省
  "合肥": { lat: 31.8206, lng: 117.2272, cityName: "合肥", province: "安徽省" },

  // 江西省
  "南昌": { lat: 28.6820, lng: 115.8579, cityName: "南昌", province: "江西省" },

  // 广西
  "南宁": { lat: 22.8170, lng: 108.3669, cityName: "南宁", province: "广西壮族自治区" },
  "桂林": { lat: 25.2736, lng: 110.2950, cityName: "桂林", province: "广西壮族自治区" },

  // 云南省
  "昆明": { lat: 25.0389, lng: 102.7183, cityName: "昆明", province: "云南省" },

  // 贵州省
  "贵阳": { lat: 26.6470, lng: 106.6302, cityName: "贵阳", province: "贵州省" },

  // 海南省
  "海口": { lat: 20.0440, lng: 110.1990, cityName: "海口", province: "海南省" },
  "三亚": { lat: 18.2528, lng: 109.5119, cityName: "三亚", province: "海南省" },

  // 甘肃省
  "兰州": { lat: 36.0611, lng: 103.8343, cityName: "兰州", province: "甘肃省" },

  // 山西省
  "太原": { lat: 37.8706, lng: 112.5489, cityName: "太原", province: "山西省" },

  // 河北省
  "石家庄": { lat: 38.0428, lng: 114.5149, cityName: "石家庄", province: "河北省" },

  // 内蒙古
  "呼和浩特": { lat: 40.8426, lng: 111.7511, cityName: "呼和浩特", province: "内蒙古自治区" },

  // 新疆
  "乌鲁木齐": { lat: 43.8256, lng: 87.6168, cityName: "乌鲁木齐", province: "新疆维吾尔自治区" },

  // 西藏
  "拉萨": { lat: 29.6500, lng: 91.1000, cityName: "拉萨", province: "西藏自治区" },

  // 宁夏
  "银川": { lat: 38.4872, lng: 106.2309, cityName: "银川", province: "宁夏回族自治区" },

  // 青海省
  "西宁": { lat: 36.6171, lng: 101.7782, cityName: "西宁", province: "青海省" },

  // 香港、澳门、台湾
  "香港": { lat: 22.3193, lng: 114.1694, cityName: "香港", province: "香港特别行政区" },
  "澳门": { lat: 22.1987, lng: 113.5439, cityName: "澳门", province: "澳门特别行政区" },
  "台北": { lat: 25.0330, lng: 121.5654, cityName: "台北", province: "台湾省" },
  "高雄": { lat: 22.6273, lng: 120.3014, cityName: "高雄", province: "台湾省" },

  // 海外主要城市
  "东京": { lat: 35.6762, lng: 139.6503, cityName: "东京", province: "日本" },
  "首尔": { lat: 37.5665, lng: 126.9780, cityName: "首尔", province: "韩国" },
  "新加坡": { lat: 1.3521, lng: 103.8198, cityName: "新加坡", province: "新加坡" },
  "纽约": { lat: 40.7128, lng: -74.0060, cityName: "纽约", province: "美国" },
  "洛杉矶": { lat: 34.0522, lng: -118.2437, cityName: "洛杉矶", province: "美国" },
  "旧金山": { lat: 37.7749, lng: -122.4194, cityName: "旧金山", province: "美国" },
  "伦敦": { lat: 51.5074, lng: -0.1278, cityName: "伦敦", province: "英国" },
  "巴黎": { lat: 48.8566, lng: 2.3522, cityName: "巴黎", province: "法国" },
  "悉尼": { lat: -33.8688, lng: 151.2093, cityName: "悉尼", province: "澳大利亚" },
  "多伦多": { lat: 43.6532, lng: -79.3832, cityName: "多伦多", province: "加拿大" },
  "温哥华": { lat: 49.2827, lng: -123.1207, cityName: "温哥华", province: "加拿大" },
};

/**
 * 地理编码：城市名称 → 经纬度
 * 支持去掉"市"后缀的模糊匹配
 */
export function geocode(locationName: string): GeoLocation | null {
  // 精确匹配
  if (CITY_DATABASE[locationName]) {
    return CITY_DATABASE[locationName];
  }

  // 去掉"市"后缀再匹配
  const withoutSuffix = locationName.replace(/市$/, "");
  if (CITY_DATABASE[withoutSuffix]) {
    return CITY_DATABASE[withoutSuffix];
  }

  // 加"市"后缀再匹配
  const withSuffix = locationName.endsWith("市") ? locationName : locationName + "市";
  if (CITY_DATABASE[withSuffix]) {
    return CITY_DATABASE[withSuffix];
  }

  // 包含匹配（如"北京市东城区" → "北京"）
  for (const [key, value] of Object.entries(CITY_DATABASE)) {
    if (locationName.includes(key) || key.includes(withoutSuffix)) {
      return value;
    }
  }

  return null;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd packages/shared && npx vitest run __tests__/geo-coding.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shared): add geo-coding city database with 70+ cities"
```

---

## Task 5: MCP-1 八字排盘服务

**Files:**
- Create: `packages/mcp-bazi/package.json`
- Create: `packages/mcp-bazi/tsconfig.json`
- Create: `packages/mcp-bazi/src/bazi-engine.ts`
- Create: `packages/mcp-bazi/src/routes.ts`
- Create: `packages/mcp-bazi/src/server.ts`
- Create: `packages/mcp-bazi/__tests__/bazi-engine.test.ts`

- [ ] **Step 1: 创建mcp-bazi包结构**

```bash
mkdir -p packages/mcp-bazi/src packages/mcp-bazi/__tests__
```

- [ ] **Step 2: 创建 packages/mcp-bazi/package.json**

```json
{
  "name": "@destiny/mcp-bazi",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@destiny/shared": "workspace:*",
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.0",
    "lunar-javascript": "^1.6.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 写八字排盘测试**

创建 `packages/mcp-bazi/__tests__/bazi-engine.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { calculateBazi } from "../src/bazi-engine.js";

describe("calculateBazi", () => {
  it("1995-06-15 14:30 北京 应排出正确四柱", () => {
    const result = calculateBazi("1995-06-15", "14:30", "male", 116.41, 39.90);

    expect(result.pillars.year).toBeDefined();
    expect(result.pillars.month).toBeDefined();
    expect(result.pillars.day).toBeDefined();
    expect(result.pillars.hour).toBeDefined();
    expect(result.dayMaster).toMatch(/[甲乙丙丁戊己庚辛壬癸]/);
  });

  it("应返回十神信息", () => {
    const result = calculateBazi("1995-06-15", "14:30", "male", 116.41, 39.90);
    expect(Object.keys(result.tenGods).length).toBeGreaterThan(0);
  });

  it("应返回大运信息", () => {
    const result = calculateBazi("1995-06-15", "14:30", "male", 116.41, 39.90);
    expect(result.dayun.length).toBeGreaterThan(0);
    expect(result.dayun[0].startAge).toBeGreaterThanOrEqual(0);
  });

  it("应返回tags数组", () => {
    const result = calculateBazi("1995-06-15", "14:30", "male", 116.41, 39.90);
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags.length).toBeGreaterThan(0);
  });

  it("女性排盘应正确处理大运顺逆", () => {
    const result = calculateBazi("1995-06-15", "14:30", "female", 116.41, 39.90);
    expect(result.dayun.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: 实现八字排盘引擎**

创建 `packages/mcp-bazi/src/bazi-engine.ts`：

```typescript
// lunar-javascript 是 CommonJS 模块，需要 default import
import lunar from "lunar-javascript";
import type { BaziResult } from "@destiny/shared";

const { Lunar, Solar } = lunar;

/**
 * 天干
 */
const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

/**
 * 十神计算
 */
function getTenGod(dayMaster: string, gan: string): string {
  const dmIndex = TIAN_GAN.indexOf(dayMaster);
  const ganIndex = TIAN_GAN.indexOf(gan);
  if (dmIndex === -1 || ganIndex === -1) return "未知";

  const dmElement = Math.floor(dmIndex / 2); // 0木 1火 2土 3金 4水
  const ganElement = Math.floor(ganIndex / 2);
  const dmYinYang = dmIndex % 2; // 0阳 1阴
  const ganYinYang = ganIndex % 2;

  const sameElement = dmElement === ganElement;
  const sameYinYang = dmYinYang === ganYinYang;

  if (sameElement) {
    return sameYinYang ? "比肩" : "劫财";
  }

  // 生我: 印
  // 我生: 食伤
  // 克我: 官杀
  // 我克: 财
  const elements = ["木", "火", "土", "金", "水"];
  const generates = (a: number, b: number) => (a + 1) % 5 === b; // a生b
  const controls = (a: number, b: number) => (a + 2) % 5 === b; // a克b

  if (generates(ganElement, dmElement)) {
    // 印（生我者）
    return sameYinYang ? "偏印" : "正印";
  }
  if (generates(dmElement, ganElement)) {
    // 食伤（我生者）
    return sameYinYang ? "食神" : "伤官";
  }
  if (controls(ganElement, dmElement)) {
    // 官杀（克我者）
    return sameYinYang ? "七杀" : "正官";
  }
  if (controls(dmElement, ganElement)) {
    // 财（我克者）
    return sameYinYang ? "偏财" : "正财";
  }
  return "未知";
}

/**
 * 八字排盘核心函数
 */
export function calculateBazi(
  date: string,
  time: string,
  gender: "male" | "female",
  lng: number,
  _lat: number
): BaziResult {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  // 使用 Solar 类创建公历日期
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();

  // 四柱
  const yearPillar = lunar.getYearInGanZhiExact();
  const monthPillar = lunar.getMonthInGanZhiExact();
  const dayPillar = lunar.getDayInGanZhiExact();
  const hourPillar = lunar.getTimeInGanZhi();

  const dayMaster = dayPillar[0]; // 日主天干

  // 十神
  const tenGods: Record<string, string> = {
    year: getTenGod(dayMaster, yearPillar[0]),
    month: getTenGod(dayMaster, monthPillar[0]),
    day: "日主",
    hour: getTenGod(dayMaster, hourPillar[0]),
  };

  // 藏干
  const hiddenStems: Record<string, string[]> = {
    year: lunar.getYearShenGong() ? [lunar.getYearHideGan()] : [],
    month: [lunar.getMonthHideGan()],
    day: [lunar.getDayHideGan()],
    hour: [lunar.getTimeHideGan()],
  };

  // 纳音
  const nayin = lunar.getDayNaYin();

  // 大运
  const dayunRaw = lunar.getEightChar().getYun(year, month, day, hour, gender === "male" ? 1 : 0);
  const dayun = dayunRaw.map((dy: any) => ({
    startAge: dy.getStartAge(),
    stems: [dy.getGanZhi()],
  }));

  // 神煞
  const shensha: string[] = [];
  const eightChar = lunar.getEightChar();
  try {
    const stars = eightChar.getShenShaNames();
    if (Array.isArray(stars)) {
      shensha.push(...stars);
    }
  } catch {
    // 某些版本API不同，跳过
  }

  // 特征标签
  const tags: string[] = [
    `${dayMaster}日主`,
    `${yearPillar[0]}${yearPillar[1]}年`,
    `${monthPillar[0]}${monthPillar[1]}月`,
  ];

  // 判断身强身弱（简化版：看月令）
  const monthZhi = monthPillar[1];
  const dayMasterElement = Math.floor(TIAN_GAN.indexOf(dayMaster) / 2);
  const monthZhiElement = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"].indexOf(monthZhi);
  const zhiElements = [3, 4, 0, 0, 4, 1, 1, 4, 3, 3, 4, 4]; // 子水 丑土 寅木 卯木...
  const monthElement = zhiElements[monthZhiElement] ?? -1;
  if (monthElement === dayMasterElement || (monthElement + 1) % 5 === dayMasterElement) {
    tags.push("身强");
  } else {
    tags.push("身弱");
  }

  return {
    pillars: {
      year: yearPillar,
      month: monthPillar,
      day: dayPillar,
      hour: hourPillar,
    },
    dayMaster,
    tenGods,
    hiddenStems,
    nayin,
    dayun,
    shensha,
    tags,
  };
}
```

> **注意**：lunar-javascript 的 API 可能在不同版本有差异。如果上述调用报错，需要查阅 [lunar-javascript 文档](https://github.com/6tail/lunar-javascript) 确认方法名。核心类是 `Solar` → `Lunar` → `EightChar`。

- [ ] **Step 6: 实现路由和服务器**

创建 `packages/mcp-bazi/src/routes.ts`：

```typescript
import type { FastifyInstance } from "fastify";
import { calculateBazi } from "./bazi-engine.js";
import { geocode, calculateSolarTime, type PaipanInput } from "@destiny/shared";

export async function baziRoutes(app: FastifyInstance) {
  app.post("/paipan", async (request, reply) => {
    const input = request.body as PaipanInput;

    // 地理编码
    let lat = input.lat;
    let lng = input.lng;
    if (lat == null || lng == null) {
      const loc = geocode(input.locationName);
      if (!loc) {
        return reply.code(400).send({
          error: "无法解析出生地，请手动输入经纬度",
          locationName: input.locationName,
        });
      }
      lat = loc.lat;
      lng = loc.lng;
    }

    // 真太阳时校准
    const solarTime = calculateSolarTime({
      date: input.birthday,
      time: input.birthTime,
      lng,
      lat,
      locationName: input.locationName,
    });

    // 八字排盘（使用校准后的真太阳时）
    const bazi = calculateBazi(
      input.birthday,
      solarTime.solarTime.split(" ")[1], // 校准后的时间
      input.gender,
      lng,
      lat
    );

    return {
      meta: {
        birthday: input.birthday,
        solarTimeCorrected: solarTime.solarTime,
        trueSolarOffsetMin: solarTime.offsetMinutes,
        gender: input.gender,
        lat,
        lng,
        timezone: solarTime.timezone,
        locationName: input.locationName,
      },
      bazi,
    };
  });

  app.post("/validate-time", async (request, reply) => {
    const { date, time, lng, lat } = request.body as {
      date: string;
      time: string;
      lng: number;
      lat: number;
    };
    const result = calculateSolarTime({
      date,
      time,
      lng,
      lat,
      locationName: "validation",
    });
    return result;
  });

  app.get("/health", async () => ({ status: "ok", service: "mcp-bazi" }));
}
```

创建 `packages/mcp-bazi/src/server.ts`：

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { baziRoutes } from "./routes.js";

const PORT = 3011;

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  await app.register(baziRoutes);

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`MCP-Bazi service listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 7: 安装依赖并运行测试**

```bash
pnpm install
cd packages/mcp-bazi && npx vitest run
```
Expected: 5 tests PASS

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(mcp-bazi): add bazi paipan service with lunar-javascript"
```

---

## Task 6: MCP-8 LLM 网关（简单透传）

**Files:**
- Create: `packages/mcp-llm/package.json`
- Create: `packages/mcp-llm/tsconfig.json`
- Create: `packages/mcp-llm/src/llm-adapter.ts`
- Create: `packages/mcp-llm/src/routes.ts`
- Create: `packages/mcp-llm/src/server.ts`
- Create: `packages/mcp-llm/__tests__/llm-adapter.test.ts`

- [ ] **Step 1: 创建包结构**

```bash
mkdir -p packages/mcp-llm/src packages/mcp-llm/__tests__
```

- [ ] **Step 2: 创建 package.json**

```json
{
  "name": "@destiny/mcp-llm",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 3: 写LLM适配器测试**

创建 `packages/mcp-llm/__tests__/llm-adapter.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { buildChatRequest, getProviderConfig } from "../src/llm-adapter.js";

describe("buildChatRequest", () => {
  it("应构建OpenAI兼容格式的请求", () => {
    const req = buildChatRequest({
      model: "gpt-4o",
      messages: [{ role: "user", content: "你好" }],
      temperature: 0.7,
    });
    expect(req.url).toContain("/v1/chat/completions");
    expect(req.body.model).toBe("gpt-4o");
    expect(req.body.messages).toHaveLength(1);
    expect(req.body.temperature).toBe(0.7);
  });

  it("应支持stream参数", () => {
    const req = buildChatRequest({
      model: "gpt-4o",
      messages: [],
      temperature: 0.5,
      stream: true,
    });
    expect(req.body.stream).toBe(true);
  });
});

describe("getProviderConfig", () => {
  it("应从环境变量读取配置", () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.openai.com";
    const config = getProviderConfig();
    expect(config.apiKey).toBe("test-key");
    expect(config.baseUrl).toBe("https://api.openai.com");
  });

  it("缺少API Key应返回null apiKey", () => {
    delete process.env.LLM_API_KEY;
    const config = getProviderConfig();
    expect(config.apiKey).toBeNull();
  });
});
```

- [ ] **Step 4: 实现LLM适配器**

创建 `packages/mcp-llm/src/llm-adapter.ts`：

```typescript
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  stream?: boolean;
}

export interface ProviderConfig {
  apiKey: string | null;
  baseUrl: string;
  defaultModel: string;
}

export function getProviderConfig(): ProviderConfig {
  return {
    apiKey: process.env.LLM_API_KEY || null,
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com",
    defaultModel: process.env.LLM_DEFAULT_MODEL || "gpt-4o",
  };
}

export function buildChatRequest(req: ChatRequest) {
  const config = getProviderConfig();
  return {
    url: `${config.baseUrl}/v1/chat/completions`,
    body: {
      model: req.model || config.defaultModel,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      stream: req.stream ?? false,
    },
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
  };
}

/**
 * 调用LLM（非流式）
 */
export async function chatCompletion(req: ChatRequest): Promise<string> {
  const { url, body, headers } = buildChatRequest(req);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * 调用LLM（流式）— 返回 ReadableStream
 */
export async function chatCompletionStream(req: ChatRequest): Promise<ReadableStream<Uint8Array>> {
  const { url, body, headers } = buildChatRequest({ ...req, stream: true });
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  return response.body!;
}
```

- [ ] **Step 5: 实现路由和服务器**

创建 `packages/mcp-llm/src/routes.ts`：

```typescript
import type { FastifyInstance } from "fastify";
import { chatCompletion, chatCompletionStream, getProviderConfig, type ChatRequest } from "./llm-adapter.js";

export async function llmRoutes(app: FastifyInstance) {
  app.post("/llm/chat", async (request, reply) => {
    const req = request.body as ChatRequest;

    try {
      if (req.stream) {
        const stream = await chatCompletionStream(req);
        return reply
          .header("Content-Type", "text/event-stream")
          .send(stream);
      }
      const content = await chatCompletion(req);
      return { content };
    } catch (err) {
      const config = getProviderConfig();
      return reply.code(503).send({
        error: "LLM调用失败",
        message: (err as Error).message,
        configured: config.apiKey !== null,
      });
    }
  });

  app.get("/health", async () => {
    const config = getProviderConfig();
    return {
      status: "ok",
      service: "mcp-llm",
      configured: config.apiKey !== null,
      baseUrl: config.baseUrl,
      defaultModel: config.defaultModel,
    };
  });
}
```

创建 `packages/mcp-llm/src/server.ts`：

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { llmRoutes } from "./routes.js";

const PORT = 3018;

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(llmRoutes);

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`MCP-LLM service listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 6: 运行测试**

```bash
cd packages/mcp-llm && npx vitest run
```
Expected: 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(mcp-llm): add LLM gateway with OpenAI-compatible adapter"
```

---

## Task 7: 编排层 — Fastify主服务 + MCP客户端 + 分析流水线

**Files:**
- Create: `packages/orchestrator/package.json`
- Create: `packages/orchestrator/tsconfig.json`
- Create: `packages/orchestrator/src/config.ts`
- Create: `packages/orchestrator/src/mcp-client/index.ts`
- Create: `packages/orchestrator/src/pipeline/index.ts`
- Create: `packages/orchestrator/src/routes/analyze.ts`
- Create: `packages/orchestrator/src/routes/stream.ts`
- Create: `packages/orchestrator/src/routes/status.ts`
- Create: `packages/orchestrator/src/server.ts`

- [ ] **Step 1: 创建包结构**

```bash
mkdir -p packages/orchestrator/src/{routes,pipeline,mcp-client} packages/orchestrator/__tests__
```

- [ ] **Step 2: 创建 package.json**

```json
{
  "name": "@destiny/orchestrator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@destiny/shared": "workspace:*",
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 3: 创建配置文件**

创建 `packages/orchestrator/src/config.ts`：

```typescript
export const MCP_PORTS = {
  BAZI: 3011,
  ZIWEI: 3012,
  VEDIC: 3013,
  WESTERN: 3014,
  ARABIC: 3015,
  RAG: 3016,
  SEARCH: 3017,
  LLM: 3018,
} as const;

export const ORCHESTRATOR_PORT = 3000;

export function mcpUrl(name: keyof typeof MCP_PORTS): string {
  return `http://localhost:${MCP_PORTS[name]}`;
}
```

- [ ] **Step 4: 实现MCP客户端**

创建 `packages/orchestrator/src/mcp-client/index.ts`：

```typescript
import { mcpUrl } from "../config.js";
import type { ChartsResult, PaipanInput } from "@destiny/shared";

/**
 * 调用MCP-Bazi排盘
 */
export async function callBaziPaipan(input: PaipanInput): Promise<Partial<ChartsResult>> {
  const response = await fetch(`${mcpUrl("BAZI")}/paipan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Bazi MCP error: ${err}`);
  }

  return response.json();
}

/**
 * 调用MCP-LLM对话
 */
export async function callLLM(req: {
  model?: string;
  messages: { role: string; content: string }[];
  temperature?: number;
}): Promise<string> {
  const response = await fetch(`${mcpUrl("LLM")}/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM MCP error: ${err}`);
  }

  const data = await response.json();
  return data.content || "";
}

/**
 * 检查MCP服务健康状态
 */
export async function checkMcpHealth(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: 实现分析流水线**

创建 `packages/orchestrator/src/pipeline/index.ts`：

```typescript
import type { SSEEvent, PaipanInput, ChartsResult } from "@destiny/shared";
import { callBaziPaipan, callLLM } from "../mcp-client/index.js";

export type ProgressCallback = (event: SSEEvent) => void;

/**
 * 分析流水线（Phase 1：仅八字排盘 + 简单LLM解读）
 */
export async function runAnalysisPipeline(
  input: PaipanInput,
  onProgress: ProgressCallback
): Promise<{ charts: Partial<ChartsResult>; analysis: string }> {
  // STEP 1: 调用八字排盘
  onProgress({ type: "progress", step: "STEP 1", message: "正在排八字盘..." });

  let charts: Partial<ChartsResult>;
  try {
    charts = await callBaziPaipan(input);
  } catch (err) {
    onProgress({ type: "error", step: "STEP 1", message: `八字排盘失败: ${(err as Error).message}` });
    throw err;
  }

  onProgress({ type: "charts", data: charts as ChartsResult });

  // STEP 2: LLM解读（如果有配置）
  onProgress({ type: "progress", step: "STEP 2", message: "正在生成命理分析..." });

  const bazi = charts.bazi;
  let analysis = "";
  if (bazi) {
    const prompt = buildBaziPrompt(bazi, charts.meta!);
    try {
      analysis = await callLLM({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "你是一位精通八字命理的专业分析师。请根据以下排盘结果，生成专业、客观的命理分析。包括性格特点、事业方向、感情特征、健康提示。用中文回答，保持简洁但专业。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      });
    } catch (err) {
      analysis = `【LLM不可用】排盘已完成，但AI分析暂不可用。错误: ${(err as Error).message}\n\n基础排盘信息：\n${prompt}`;
    }
  }

  onProgress({ type: "analysis", section: "八字分析", content: analysis });

  onProgress({
    type: "done",
    analysisId: `analysis-${Date.now()}`,
    tokens: 0,
  });

  return { charts, analysis };
}

function buildBaziPrompt(bazi: any, meta: any): string {
  return `出生信息：
- 日期：${meta.birthday}
- 真太阳时：${meta.solarTimeCorrected}（校准偏移${meta.trueSolarOffsetMin}分钟）
- 性别：${meta.gender === "male" ? "男" : "女"}
- 出生地：${meta.locationName}（${meta.lat}, ${meta.lng}）

八字四柱：
- 年柱：${bazi.pillars.year}
- 月柱：${bazi.pillars.month}
- 日柱：${bazi.pillars.day}（日主：${bazi.dayMaster}）
- 时柱：${bazi.pillars.hour}

十神：${JSON.stringify(bazi.tenGods)}
纳音：${bazi.nayin}
神煞：${bazi.shensha.join("、")}
大运：${bazi.dayun.map((d: any) => `${d.startAge}岁起 ${d.stems.join("")}`).join("；")}
特征标签：${bazi.tags.join("、")}

请根据以上排盘结果进行详细的命理分析。`;
}
```

- [ ] **Step 6: 实现路由**

创建 `packages/orchestrator/src/routes/analyze.ts`：

```typescript
import type { FastifyInstance } from "fastify";
import type { PaipanInput } from "@destiny/shared";
import { runAnalysisPipeline } from "../pipeline/index.js";

// 存储活跃的SSE连接
export const activeStreams = new Map<string, (event: any) => void>();

export async function analyzeRoutes(app: FastifyInstance) {
  app.post("/api/analyze", async (request, reply) => {
    const input = request.body as PaipanInput;

    // 基本校验
    if (!input.birthday || !input.birthTime || !input.gender || !input.locationName) {
      return reply.code(400).send({
        error: "缺少必填字段",
        required: ["birthday", "birthTime", "gender", "locationName"],
      });
    }

    const analysisId = `analysis-${Date.now()}`;

    // 存储进度回调，SSE连接时取出
    const events: any[] = [];
    const onProgress = (event: any) => {
      events.push(event);
      // 通知等待中的SSE连接
      const callback = activeStreams.get(analysisId);
      if (callback) callback(event);
    };

    // 异步启动流水线
    runAnalysisPipeline(input, onProgress).catch((err) => {
      onProgress({ type: "error", step: "pipeline", message: err.message });
    });

    // 暂存事件队列供SSE连接消费
    activeStreams.set(analysisId, () => {});

    return { analysisId, message: "分析已启动，请连接 SSE 获取结果" };
  });
}
```

创建 `packages/orchestrator/src/routes/stream.ts`：

```typescript
import type { FastifyInstance } from "fastify";

// 简单事件队列存储
const eventQueues = new Map<string, any[]>();
const waiters = new Map<string, ((event: any) => void)[]>();

export function pushEvent(analysisId: string, event: any) {
  const queue = eventQueues.get(analysisId) || [];
  queue.push(event);
  eventQueues.set(analysisId, queue);

  const callbacks = waiters.get(analysisId) || [];
  const cb = callbacks.shift();
  if (cb) {
    cb(event);
  }
}

export async function streamRoutes(app: FastifyInstance) {
  app.get("/api/stream/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // 发送已有事件
    const existing = eventQueues.get(id) || [];
    for (const evt of existing) {
      reply.raw.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
      if (evt.type === "done" || evt.type === "error") {
        reply.raw.end();
        return;
      }
    }

    // 注册等待新事件
    const waitForEvent = () => {
      const callbacks = waiters.get(id) || [];
      callbacks.push((event: any) => {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

        if (event.type === "done" || event.type === "error") {
          reply.raw.end();
          eventQueues.delete(id);
          waiters.delete(id);
        } else {
          waitForEvent();
        }
      });
      waiters.set(id, callbacks);
    };

    waitForEvent();

    // 客户端断开时清理
    request.raw.on("close", () => {
      eventQueues.delete(id);
      waiters.delete(id);
    });
  });
}
```

创建 `packages/orchestrator/src/routes/status.ts`：

```typescript
import type { FastifyInstance } from "fastify";
import { MCP_PORTS } from "../config.js";
import { checkMcpHealth } from "../mcp-client/index.js";

export async function statusRoutes(app: FastifyInstance) {
  app.get("/api/status", async () => {
    const services = await Promise.all(
      Object.entries(MCP_PORTS).map(async ([name, port]) => {
        const healthy = await checkMcpHealth(port);
        return { name, port, status: healthy ? "online" : "offline" };
      })
    );

    return { services };
  });
}
```

- [ ] **Step 7: 实现主服务器**

创建 `packages/orchestrator/src/server.ts`：

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { analyzeRoutes } from "./routes/analyze.js";
import { streamRoutes } from "./routes/stream.js";
import { statusRoutes } from "./routes/status.js";
import { ORCHESTRATOR_PORT } from "./config.js";

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  await app.register(analyzeRoutes);
  await app.register(streamRoutes);
  await app.register(statusRoutes);

  try {
    await app.listen({ port: ORCHESTRATOR_PORT, host: "0.0.0.0" });
    app.log.info(`Orchestrator listening on port ${ORCHESTRATOR_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(orchestrator): add Fastify server with analyze pipeline and SSE streaming"
```

---

## Task 8: 前端 — React SPA 骨架

**Files:**
- Create: `packages/frontend/package.json`
- Create: `packages/frontend/vite.config.ts`
- Create: `packages/frontend/tsconfig.json`
- Create: `packages/frontend/index.html`
- Create: `packages/frontend/src/main.tsx`
- Create: `packages/frontend/src/App.tsx`
- Create: `packages/frontend/src/components/InputForm.tsx`
- Create: `packages/frontend/src/components/BaziChart.tsx`
- Create: `packages/frontend/src/components/StatusBadge.tsx`
- Create: `packages/frontend/src/hooks/useSSE.ts`
- Create: `packages/frontend/src/api/client.ts`

- [ ] **Step 1: 用Vite创建前端项目**

```bash
cd /workspace/packages && npx create-vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: 安装依赖**

```bash
cd /workspace/packages/frontend && pnpm install
pnpm add tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: 配置Vite代理**

修改 `packages/frontend/vite.config.ts`：

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: 添加Tailwind CSS**

创建 `packages/frontend/src/index.css`：

```css
@import "tailwindcss";
```

修改 `packages/frontend/src/main.tsx`：

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: 实现API客户端**

创建 `packages/frontend/src/api/client.ts`：

```typescript
const API_BASE = "/api";

export interface PaipanInput {
  birthday: string;
  birthTime: string;
  gender: "male" | "female";
  locationName: string;
  lat?: number;
  lng?: number;
  timezone?: string;
}

export async function startAnalysis(input: PaipanInput): Promise<{ analysisId: string }> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function getStatus(): Promise<{ services: { name: string; port: number; status: string }[] }> {
  const res = await fetch(`${API_BASE}/status`);
  return res.json();
}
```

- [ ] **Step 6: 实现SSE Hook**

创建 `packages/frontend/src/hooks/useSSE.ts`：

```typescript
import { useState, useCallback } from "react";

export interface SSEEvent {
  type: string;
  [key: string]: any;
}

export function useSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const connect = useCallback((analysisId: string) => {
    setEvents([]);
    setIsDone(false);
    setIsConnected(true);

    const eventSource = new EventSource(`/api/stream/${analysisId}`);

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setEvents((prev) => [...prev, data]);
        if (data.type === "done" || data.type === "error") {
          setIsDone(true);
          eventSource.close();
          setIsConnected(false);
        }
      } catch {
        // 忽略解析错误
      }
    };

    eventSource.addEventListener("progress", handler);
    eventSource.addEventListener("charts", handler);
    eventSource.addEventListener("analysis", handler);
    eventSource.addEventListener("done", handler);
    eventSource.addEventListener("error", handler);

    eventSource.onerror = () => {
      setIsConnected(false);
    };
  }, []);

  return { events, isConnected, isDone, connect };
}
```

- [ ] **Step 7: 实现输入表单组件**

创建 `packages/frontend/src/components/InputForm.tsx`：

```typescript
import { useState } from "react";
import type { PaipanInput } from "../api/client";

interface Props {
  onSubmit: (input: PaipanInput) => void;
  loading: boolean;
}

export function InputForm({ onSubmit, loading }: Props) {
  const [birthday, setBirthday] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [locationName, setLocationName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ birthday, birthTime, gender, locationName });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm text-zinc-500 mb-1">出生日期（公历）</label>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          required
          className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-zinc-500 mb-1">出生时间</label>
          <input
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            required
            className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-500 mb-1">性别</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female")}
            className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
          >
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm text-zinc-500 mb-1">出生地</label>
        <input
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="如：北京、上海"
          required
          className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
      >
        {loading ? "分析中..." : "开始排盘分析"}
      </button>
    </form>
  );
}
```

- [ ] **Step 8: 实现排盘展示组件**

创建 `packages/frontend/src/components/BaziChart.tsx`：

```typescript
interface BaziData {
  pillars: { year: string; month: string; day: string; hour: string };
  dayMaster: string;
  tenGods: Record<string, string>;
  nayin: string;
  shensha: string[];
  dayun: { startAge: number; stems: string[] }[];
  tags: string[];
}

export function BaziChart({ data, meta }: { data: BaziData; meta: any }) {
  const pillars = [
    { label: "年柱", value: data.pillars.year, god: data.tenGods.year },
    { label: "月柱", value: data.pillars.month, god: data.tenGods.month },
    { label: "日柱", value: data.pillars.day, god: "日主" },
    { label: "时柱", value: data.pillars.hour, god: data.tenGods.hour },
  ];

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-500">
        校准后：{meta?.solarTimeCorrected} | {meta?.locationName}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {pillars.map((p) => (
          <div
            key={p.label}
            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-center"
          >
            <div className="text-xs text-zinc-500 mb-1">{p.label}</div>
            <div className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {p.value}
            </div>
            <div className="text-xs text-violet-600 dark:text-violet-400 mt-1">
              {p.god}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.tags.map((tag, i) => (
          <span
            key={i}
            className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 rounded-full text-xs"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-zinc-500">纳音：</span>
          <span>{data.nayin}</span>
        </div>
        {data.shensha.length > 0 && (
          <div>
            <span className="text-zinc-500">神煞：</span>
            <span>{data.shensha.join("、")}</span>
          </div>
        )}
        {data.dayun.length > 0 && (
          <div>
            <span className="text-zinc-500">大运：</span>
            {data.dayun.map((d, i) => (
              <span key={i} className="mr-2">
                {d.startAge}岁 {d.stems.join("")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: 实现状态徽章组件**

创建 `packages/frontend/src/components/StatusBadge.tsx`：

```typescript
import { useState, useEffect } from "react";
import { getStatus } from "../api/client";

export function StatusBadge() {
  const [services, setServices] = useState<{ name: string; port: number; status: string }[]>([]);

  useEffect(() => {
    const fetchStatus = () => getStatus().then((d) => setServices(d.services)).catch(() => {});
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-1.5">
      {services.map((s) => (
        <div key={s.name} className="flex items-center justify-between text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">MCP {s.name}</span>
          <span
            className={
              s.status === "online"
                ? "text-green-600 dark:text-green-400"
                : "text-zinc-400"
            }
          >
            ● {s.status === "online" ? "在线" : "离线"}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 10: 实现主App**

创建 `packages/frontend/src/App.tsx`：

```typescript
import { useState } from "react";
import { InputForm } from "./components/InputForm";
import { BaziChart } from "./components/BaziChart";
import { StatusBadge } from "./components/StatusBadge";
import { useSSE } from "./hooks/useSSE";
import { startAnalysis, type PaipanInput } from "./api/client";

export default function App() {
  const [loading, setLoading] = useState(false);
  const { events, connect, isDone } = useSSE();
  const [charts, setCharts] = useState<any>(null);
  const [analysis, setAnalysis] = useState("");

  const handleSubmit = async (input: PaipanInput) => {
    setLoading(true);
    setCharts(null);
    setAnalysis("");

    try {
      const { analysisId } = await startAnalysis(input);
      connect(analysisId);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // 处理SSE事件
  useEffect(() => {
    if (events.length === 0) return;

    const latest = events[events.length - 1];
    if (latest.type === "charts" && latest.data) {
      setCharts(latest.data);
    }
    if (latest.type === "analysis") {
      setAnalysis(latest.content);
    }
    if (latest.type === "done" || latest.type === "error") {
      setLoading(false);
    }
  }, [events]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
          <span className="font-medium">命理罗盘 · Destiny Compass</span>
        </div>
      </header>

      <div className="flex gap-4 p-4 max-w-7xl mx-auto">
        {/* 左侧 */}
        <div className="w-80 space-y-4 shrink-0">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <h2 className="font-medium mb-3">排盘输入</h2>
            <InputForm onSubmit={handleSubmit} loading={loading} />
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <h2 className="font-medium mb-3">系统状态</h2>
            <StatusBadge />
          </div>
        </div>

        {/* 右侧 */}
        <div className="flex-1 space-y-4">
          {charts ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h2 className="font-medium mb-4">命盘总览</h2>
              <BaziChart data={charts.bazi} meta={charts.meta} />
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 text-center text-zinc-400">
              请在左侧输入出生信息开始排盘
            </div>
          )}

          {analysis && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h2 className="font-medium mb-3">命理分析</h2>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {analysis}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat(frontend): add React SPA with input form, bazi chart, and SSE streaming"
```

---

## Task 9: 端到端验证

- [ ] **Step 1: 安装所有依赖**

```bash
cd /workspace && pnpm install
```

- [ ] **Step 2: 启动所有服务**

开4个终端窗口分别运行：

```bash
# 终端1: MCP-1 八字
pnpm dev:mcp-bazi

# 终端2: MCP-8 LLM
pnpm dev:mcp-llm

# 终端3: 编排层
pnpm dev:orchestrator

# 终端4: 前端
pnpm dev:frontend
```

- [ ] **Step 3: 手动测试端到端流程**

打开浏览器访问 `http://localhost:5173`

1. 输入：1995-06-15, 14:30, 男, 北京
2. 点击"开始排盘分析"
3. 验证：
   - 系统状态显示 MCP-BAZI 在线、MCP-LLM 在线
   - 右侧出现八字排盘结果（四柱、十神、纳音、大运、神煞）
   - 如果配置了LLM_API_KEY，出现AI分析文本
   - 如果未配置LLM_API_KEY，显示降级提示

- [ ] **Step 4: 运行全部测试**

```bash
cd /workspace && pnpm test
```
Expected: 所有包测试 PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: phase 1 end-to-end verification complete"
```

---

## 后续阶段规划（参考）

- **Phase 2**: 接入 MCP-2 紫微、MCP-3 印度、MCP-4 西洋、MCP-5 阿拉伯排盘
- **Phase 3**: 接入 MCP-6 RAG知识库 + MCP-7 多源搜索
- **Phase 4**: 完善LLM分析流水线（分术数解读 → 总论 → 注意事项）
- **Phase 5**: 事件级精确运势预测（逐日/逐月/逐年）
- **Phase 6**: 前端运势日历视图 + 5术数Tab切换 + 暗色模式
- **Phase 7**: Docker Compose 一键部署 + 历史记录持久化
