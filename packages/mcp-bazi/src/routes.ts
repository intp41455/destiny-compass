import type { FastifyInstance } from "fastify";
import { calculateBazi } from "./bazi-engine.js";
import { geocode, calculateSolarTime, type PaipanInput } from "@destiny/shared";

/**
 * MCP-1 八字排盘服务路由
 * 暴露：
 *  POST /paipan      完整排盘（含真太阳时校准 + 地理编码回退）
 *  POST /validate-time  仅校准真太阳时
 *  GET  /health      健康检查
 */
export async function baziRoutes(app: FastifyInstance) {
  app.post("/paipan", async (request, reply) => {
    const input = request.body as PaipanInput;

    if (!input?.birthday || !input?.birthTime || !input?.gender) {
      return reply.code(400).send({
        error: "缺少必要字段 birthday/birthTime/gender",
      });
    }

    // 地理编码：优先用显式经纬度，否则按出生地查表
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

    // solarTime.solarTime 格式为 "YYYY-MM-DD HH:MM"，按空格拆分
    // 跨日情况由 solarTime 计算自动处理（如深夜出生校正后跨入次日）
    const [correctedDate, correctedTime] = solarTime.solarTime.split(" ");

    // 八字排盘（使用校准后的真太阳时日期与时间）
    const bazi = calculateBazi(
      correctedDate,
      correctedTime,
      input.gender,
      lng,
      lat,
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

  app.post("/validate-time", async (request) => {
    const { date, time, lng, lat } = request.body as {
      date: string;
      time: string;
      lng: number;
      lat: number;
    };
    return calculateSolarTime({
      date,
      time,
      lng,
      lat,
      locationName: "validation",
    });
  });

  app.get("/health", async () => ({ status: "ok", service: "mcp-bazi" }));
}
