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
