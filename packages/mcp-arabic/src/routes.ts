import type { FastifyInstance } from "fastify";
import { calculateArabic } from "./arabic-engine.js";
import { geocode, calculateSolarTime, type PaipanInput } from "@destiny/shared";

/**
 * MCP-5 阿拉伯占星排盘服务路由
 *
 * 暴露：
 *  POST /paipan      完整排盘（含真太阳时校准 + 地理编码回退）
 *  GET  /health      健康检查
 */
export async function arabicRoutes(app: FastifyInstance) {
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

    const arabic = calculateArabic(correctedDate, correctedTime, lat, lng);

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
      arabic,
    };
  });

  app.get("/health", async () => ({ status: "ok", service: "mcp-arabic" }));
}
