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
  const date = new Date(dateStr + "T00:00:00Z");
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
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

  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const solarHours = Math.floor(normalizedMinutes / 60);
  const solarMinutes = Math.floor(normalizedMinutes % 60);

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
    timezone,
  };
}
