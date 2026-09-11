import { useState } from "react";
import type { PaipanInput } from "../api/client";

interface Props {
  onSubmit: (input: PaipanInput) => void;
  loading: boolean;
}

const DEFAULT_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  北京: { lat: 39.9042, lng: 116.4074 },
  上海: { lat: 31.2304, lng: 121.4737 },
  广州: { lat: 23.1291, lng: 113.2644 },
  深圳: { lat: 22.5431, lng: 114.0579 },
  成都: { lat: 30.5728, lng: 104.0668 },
  杭州: { lat: 30.2741, lng: 120.1551 },
  武汉: { lat: 30.5928, lng: 114.3055 },
  西安: { lat: 34.3416, lng: 108.9398 },
  纽约: { lat: 40.7128, lng: -74.006 },
  伦敦: { lat: 51.5074, lng: -0.1278 },
  东京: { lat: 35.6762, lng: 139.6503 },
  悉尼: { lat: -33.8688, lng: 151.2093 },
};

export function InputForm({ onSubmit, loading }: Props) {
  const [birthday, setBirthday] = useState("1990-01-01");
  const [birthTime, setBirthTime] = useState("12:00");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [locationName, setLocationName] = useState("北京");
  const [useManualCoords, setUseManualCoords] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      setError("请选择有效的出生日期");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(birthTime)) {
      setError("请选择有效的出生时间");
      return;
    }

    const input: PaipanInput = {
      birthday,
      birthTime,
      gender,
      locationName: useManualCoords ? locationName || "自定义" : locationName,
    };

    if (useManualCoords) {
      if (lat === "" || lng === "" || isNaN(Number(lat)) || isNaN(Number(lng))) {
        setError("请输入有效的经纬度");
        return;
      }
      input.lat = Number(lat);
      input.lng = Number(lng);
    } else {
      const match = DEFAULT_LOCATIONS[locationName.trim()];
      if (match) {
        input.lat = match.lat;
        input.lng = match.lng;
      }
    }

    onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs text-zinc-500 mb-1">出生日期（公历）</label>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          required
          className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">出生时间</label>
          <input
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            required
            className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">性别</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female")}
            className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-zinc-500 mb-1">出生地</label>
        <input
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="如：北京 / 上海 / 纽约"
          required
          className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer py-1">
        <input
          type="checkbox"
          checked={useManualCoords}
          onChange={(e) => setUseManualCoords(e.target.checked)}
          className="accent-brand-600 w-4 h-4"
        />
        手动指定经纬度（地名匹配失败时使用）
      </label>

      {useManualCoords && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">纬度 lat</label>
            <input
              type="number"
              step="0.0001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="39.9042"
              className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">经度 lng</label>
            <input
              type="number"
              step="0.0001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="116.4074"
              className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[3rem] py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors active:scale-[0.98]"
      >
        {loading ? "分析中…" : "开始排盘分析"}
      </button>
    </form>
  );
}
