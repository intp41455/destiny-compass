import type { SolarTimeResult } from "./types.js";

interface CalcInput {
  date: string;
  time: string;
  lng: number;
  lat: number;
  locationName: string;
}

function equationOfTime(dayOfYear: number): number {
  const B = (2 * Math.PI * (dayOfYear - 81)) / 365;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

function getDayOfYear(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00Z");
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function calculateSolarTime(input: CalcInput): SolarTimeResult {
  const { date, time, lng, lat, locationName } = input;
  const standardMeridian = Math.round(lng / 15) * 15;
  const longitudeDiffMinutes = (lng - standardMeridian) * 4;
  const dayOfYear = getDayOfYear(date);
  const eotMinutes = equationOfTime(dayOfYear);
  const offsetMinutes = longitudeDiffMinutes + eotMinutes;

  const [hours, minutes] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + offsetMinutes;
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const solarHours = Math.floor(normalizedMinutes / 60);
  const solarMinutes = Math.floor(normalizedMinutes % 60);

  const solarTimeStr = `${date} ${String(solarHours).padStart(2, "0")}:${String(solarMinutes).padStart(2, "0")}`;
  const timezoneOffset = Math.round(lng / 15);
  const timezone = timezoneOffset >= 0 ? `UTC+${timezoneOffset}` : `UTC${timezoneOffset}`;

  return {
    inputTime: `${date} ${time}`,
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
