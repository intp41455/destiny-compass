import type { FastifyInstance } from "fastify";
import { calculateWestern } from "./western-engine.js";
import { geocode, calculateSolarTime, type PaipanInput } from "@destiny/shared";

/**
 * MCP-4 古典占星排盘服务路由
 *
 * 暴露：
 *  POST /paipan      完整排盘（含真太阳时校准 + 地理编码回退）
 *  GET  /health      健康检查
 *
 * body 中可带 age（当前年龄），默认从生日推算
 */
export async function westernRoutes(app: FastifyInstance) {
  app.post("/paipan", async (request, reply) => {
    const input = (request.body as PaipanInput & { age?: number }) ?? {};
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

    // 推算年龄（以今年生日为准）
    let age = input.age ?? 30;
    if (input.age == null) {
      const [y, m, d] = input.birthday.split("-").map(Number);
      const now = new Date();
      age = now.getFullYear() - y;
      const hadBirthday = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
      if (!hadBirthday) age--;
      if (age < 0) age = 0;
    }

    const western = calculateWestern(correctedDate, correctedTime, input.gender, lat, lng, age);

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
      western,
    };
  });

  app.get("/health", async () => ({ status: "ok", service: "mcp-western" }));
}
