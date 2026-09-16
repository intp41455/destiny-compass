import type { FastifyInstance } from "fastify";
import { calculateZiwei } from "./ziwei-engine.js";
import { geocode, calculateSolarTime, type PaipanInput } from "@destiny/shared";

/**
 * MCP-2 紫微斗数排盘服务路由
 *
 * 暴露：
 *  POST /paipan      完整排盘（含真太阳时校准 + 地理编码回退）
 *  POST /validate-time  仅校准真太阳时
 *  GET  /health      健康检查
 */
export async function ziweiRoutes(app: FastifyInstance) {
  app.post("/paipan", async (request, reply) => {
    const input = request.body as PaipanInput;
    if (!input?.birthday || !input?.birthTime || !input?.gender) {
      return reply.code(400).send({
        error: "缺少必要字段 birthday/birthTime/gender",
      });
    }

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

    const solarTime = calculateSolarTime({
      date: input.birthday,
      time: input.birthTime,
      lng,
      lat,
      locationName: input.locationName,
    });

    const [correctedDate, correctedTime] = solarTime.solarTime.split(" ");

    const ziwei = calculateZiwei(correctedDate, correctedTime, input.gender);

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
      ziwei,
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

  app.get("/health", async () => ({ status: "ok", service: "mcp-ziwei" }));
}
