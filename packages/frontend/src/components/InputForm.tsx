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
  const [useManualCoords, setUseManualCoords] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: PaipanInput = {
      birthday,
      birthTime,
      gender,
      locationName: useManualCoords ? locationName || "自定义" : locationName,
    };
    if (useManualCoords && lat && lng) {
      input.lat = Number(lat);
      input.lng = Number(lng);
    }
    onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">出生日期（公历）</label>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          required
          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
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
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">性别</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female")}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
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
          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
        <input
          type="checkbox"
          checked={useManualCoords}
          onChange={(e) => setUseManualCoords(e.target.checked)}
          className="accent-brand-600"
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
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
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
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "分析中…" : "开始排盘分析"}
      </button>
    </form>
  );
}
