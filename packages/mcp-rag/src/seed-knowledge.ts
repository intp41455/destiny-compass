/**
 * 命理种子知识库
 *
 * 每条 entry 包含：
 *  - id: 稳定 ID
 *  - system: 八字 / 紫微 / 印度 / 西洋 / 阿拉伯 / 通用
 *  - tags: 关键词数组（与排盘 tags 重叠度高的优先召回）
 *  - title: 标题
 *  - text: 正文断语
 *  - source: 经典出处
 *
 * 这是混合方案中的"种子知识库"——可由用户后续通过 POST /documents 扩展。
 */
export interface KnowledgeEntry {
  id: string;
  system: "bazi" | "ziwei" | "vedic" | "western" | "arabic" | "general";
  tags: string[];
  title: string;
  text: string;
  source: string;
}

export const SEED_KNOWLEDGE: KnowledgeEntry[] = [
  // ============ 八字 ============
  {
    id: "bazi-001",
    system: "bazi",
    tags: ["甲日主", "身弱", "印", "正印", "偏印"],
    title: "甲木身弱喜水印",
    text: "甲木生于春夏火旺之地而身弱，最喜癸水偏印生身。逢子亥年月印星发力，主学业、贵人提拔；忌金财破印，否则智慧难展。",
    source: "《子平真诠》卷三",
  },
  {
    id: "bazi-002",
    system: "bazi",
    tags: ["乙日主", "财", "正财", "身弱"],
    title: "乙木身弱忌财破印",
    text: "乙木柔蔓，身弱则忌戊己厚土破印耗身。生于季月土旺，财多身弱主辛劳谋生，得比劫制财则可富。透印化杀尤吉。",
    source: "《滴天髓》",
  },
  {
    id: "bazi-003",
    system: "bazi",
    tags: ["丙日主", "七杀", "壬", "身弱"],
    title: "丙火身弱逢壬杀",
    text: "丙火猛烈，身弱逢壬水七杀透干，若无甲乙化杀或戊己制杀，主奔波、压力、易患心血管。逢寅卯印地则化杀为权。",
    source: "《穷通宝鉴》",
  },
  {
    id: "bazi-004",
    system: "bazi",
    tags: ["丁日主", "财", "金", "身弱"],
    title: "丁火身弱喜甲引丁",
    text: "丁火灯烛之性，身弱喜甲木为薪引丁，忌见庚金破甲。生于秋月金旺之地，财多身弱，得比劫印星则财能任之。",
    source: "《滴天髓》",
  },
  {
    id: "bazi-005",
    system: "bazi",
    tags: ["伤官", "食神", "财"],
    title: "伤官生财格",
    text: "伤官生财格，须身旺财弱，伤官泄秀生财。财藏库地、伤官得禄，主富甲一方；财多无劫，反主奔波劳碌。",
    source: "《子平真诠》",
  },
  {
    id: "bazi-006",
    system: "bazi",
    tags: ["七杀", "制杀", "化杀"],
    title: "七杀有制化为权",
    text: "七杀成格者，需有制（食神制杀）或有化（印化杀）。制杀者主武贵，化杀者主文贵。无制无化则煞攻身，主灾厄。",
    source: "《子平真诠》",
  },

  // ============ 紫微斗数 ============
  {
    id: "ziwei-001",
    system: "ziwei",
    tags: ["命宫主星:紫微", "杀破狼格", "紫微在午"],
    title: "紫微在午入命宫",
    text: "紫微为帝座，居午宫为入庙，主贵气、领导、贵气加身。但需左辅右弼相会，否则孤君无依，主清高但孤寡。",
    source: "《紫微斗数全书》",
  },
  {
    id: "ziwei-002",
    system: "ziwei",
    tags: ["杀破狼格", "七杀", "破军", "贪狼"],
    title: "杀破狼格局主变动",
    text: "杀破狼入命三方，主一生变动剧烈，宜武职、商贾、技术。早年辛苦，中年发迹。会煞忌则多波折，会禄权则骤发。",
    source: "《紫微斗数全书》",
  },
  {
    id: "ziwei-003",
    system: "ziwei",
    tags: ["机月同梁格", "天机", "太阴", "天同", "天梁"],
    title: "机月同梁作吏人",
    text: "机月同梁格，主稳定公职、文职。天机主智、太阴主财、天同主福、天梁主荫。四星会于命三方，主清贵、稳定、福寿。",
    source: "《紫微斗数全书》",
  },
  {
    id: "ziwei-004",
    system: "ziwei",
    tags: ["紫微在子", "紫微在午", "身宫主星"],
    title: "命身宫主星论",
    text: "命宫主先天格局，身宫主后天行运。命宫主星弱而身宫主星强，主中年方发。反之早年得意而中年式微。",
    source: "《紫微斗数全书》",
  },
  {
    id: "ziwei-005",
    system: "ziwei",
    tags: ["禄", "权", "科", "忌"],
    title: "四化禄权科忌论",
    text: "化禄主财缘、化权主权威、化科主名声、化忌主阻碍。禄入命财主富，权入官迁主贵，科入父兄主名，忌入何宫即何处生烦恼。",
    source: "《紫微斗数全书》",
  },

  // ============ 印度占星 ============
  {
    id: "vedic-001",
    system: "vedic",
    tags: ["Lagna:Mesha", "火星", "Rahu"],
    title: "Mesha Lagna（白羊上升）",
    text: "白羊上升者性格果断、好胜、行动力强。命主星为火星，火星强弱决定一生格局。Rahu 在 1 宫则性格怪异、易招是非。",
    source: "BPHS（Parashara Hora Shastra）",
  },
  {
    id: "vedic-002",
    system: "vedic",
    tags: ["月亮Nakshatra:Rohini", "月亮Nakshatra:Chitra"],
    title: "Rohini / Chitra 月宿",
    text: "Rohini 宿主美丽、艺术、富足；Chitra 宿主聪明、设计、声名。月宿决定心性、配偶、母亲缘分。",
    source: "BPHS",
  },
  {
    id: "vedic-003",
    system: "vedic",
    tags: ["当前Mahadasha:Saturn", "Saturn"],
    title: "土星大运 19 年",
    text: "土星 Mahadasha 主 19 年，主劳碌、责任、积累。土星强则事业成、地位升；土星弱则疾病、损失、逆境。Antardasha 亦是。",
    source: "BPHS Vimshottari",
  },
  {
    id: "vedic-004",
    system: "vedic",
    tags: ["Yoga:Gaja Kesari Yoga（月木吉相）", "jupiter"],
    title: "Gaja Kesari Yoga",
    text: "月亮与木星三合/对冲/合相，构成 Gaja Kesari Yoga，主智慧、名声、长寿。木星在角宫（Kendra）时尤吉。",
    source: "BPHS",
  },
  {
    id: "vedic-005",
    system: "vedic",
    tags: ["Gochara", "saturn", "jupiter"],
    title: "Gochara 推运原则",
    text: "Gochara 看过宫星与本命月亮的关系。土星过月亮 12 宫（Sade Sati）七年主考验；木星过月亮 Rashi 主一年好运。",
    source: "BPHS",
  },

  // ============ 古典占星 ============
  {
    id: "western-001",
    system: "western",
    tags: ["上升:Aries", "rulership", "mars"],
    title: "白羊上升（ASC in Aries）",
    text: "白羊上升者外向、果决、行动派。命主星 Mars，火星落点决定一生重心。火星入 1 宫主早年独立、入 10 宫主事业显赫。",
    source: "William Lilly, Christian Astrology",
  },
  {
    id: "western-002",
    system: "western",
    tags: ["conjunction", "square", "opposition"],
    title: "主要相位含义",
    text: "合相主能量集中；六合（60°）主和谐机会；刑相（90°）主冲突挑战；三合（120°）主顺遂天赋；对冲（180°）主对立拉锯。",
    source: "Ptolemy, Tetrabiblos",
  },
  {
    id: "western-003",
    system: "western",
    tags: ["rulership", "exaltation", "detriment", "fall"],
    title: "行星尊贵表（Essential Dignities）",
    text: "行星入庙（rulership）最强，跃升（exaltation）次之；失势（detriment）为入庙之反，落陷（fall）为跃升之反。庙跃者吉，失落者凶。",
    source: "Ptolemy, Tetrabiblos",
  },
  {
    id: "western-004",
    system: "western",
    tags: ["Firdaria", "日生", "夜生"],
    title: "Firdaria 时主星限",
    text: "法达星限以 7 大行星 + 北交点按 Chaldean 序列分配年限。日生从太阳起，夜生从月亮起。当前主星决定大方向，副星决定细节。",
    source: "Bonatti, Liber Astronomiae",
  },
  {
    id: "western-005",
    system: "western",
    tags: ["Profection", "yearAge"],
    title: "年度小限 Profection",
    text: "小限每 12 年一轮回，0/12/24 岁主第 1 宫（命宫）；1/13/25 主 2 宫；以此类推。该年主星决定全年基调。",
    source: "Vettius Valens, Anthology",
  },

  // ============ 阿拉伯占星 ============
  {
    id: "arabic-001",
    system: "arabic",
    tags: ["福点", "Part of Fortune"],
    title: "阿拉伯福点（Part of Fortune）",
    text: "福点 ASC + 月 - 日（日生）或 ASC + 日 - 月（夜生）。所在宫位主一生福报所在；与吉星合相主富，与凶星合相主破财。",
    source: "Al-Biruni, Book of Instruction",
  },
  {
    id: "arabic-002",
    system: "arabic",
    tags: ["灵点", "Part of Spirit"],
    title: "阿拉伯灵点（Part of Spirit）",
    text: "灵点 ASC + 日 - 月（日生）或 ASC + 月 - 日（夜生）。所在宫位主一生精神追求所在；与吉星合相主名声成就。",
    source: "Al-Biruni, Book of Instruction",
  },
  {
    id: "arabic-003",
    system: "arabic",
    tags: ["北交点", "南交点", "Rahu", "Ketu"],
    title: "月亮交点（Lunar Nodes）",
    text: "北交点主扩张、机会、外来缘分；南交点主收缩、业力、过去积累。北交所在宫位为今生课题，南交所在宫位为宿世天赋。",
    source: "Bonatti, Liber Astronomiae",
  },
  {
    id: "arabic-004",
    system: "arabic",
    tags: ["日主星", "时主星", "Chaldean"],
    title: "日主星与时主星",
    text: "日主星按周日=Sun、周一=Moon、周二=Mars…周六=Saturn。时主星按日主星起，按 Chaldean 序列（sat→jup→mar→sun→ven→mer→moon）循环。",
    source: "Al-Biruni, Book of Instruction",
  },

  // ============ 通用 / 跨术数 ============
  {
    id: "general-001",
    system: "general",
    tags: ["日生", "夜生", "昼夜"],
    title: "日生 / 夜生命盘",
    text: "昼夜判断在西洋/印度/阿拉伯系统都重要。日生者太阳在 7-12 宫（地平线上），夜生者在 1-6 宫。日生盘重日星，夜生盘重月星。",
    source: "通用规则",
  },
  {
    id: "general-002",
    system: "general",
    tags: ["身强", "身弱", "印", "比劫"],
    title: "身强身弱判断原则",
    text: "八字身强身弱看月令、印比、财官杀伤。身强宜财官杀伤泄秀，身弱宜印比生扶。判定后才能定用神。",
    source: "《子平真诠》",
  },
  {
    id: "general-003",
    system: "general",
    tags: ["大运", "流年", "运势"],
    title: "大运流年看法",
    text: "大运（10 年）决定 10 年趋势，流年（1 年）决定年运起伏。大运吉而流年凶则小损，大运凶而流年吉则虚惊。流月流日再细化。",
    source: "通用规则",
  },
  {
    id: "general-004",
    system: "general",
    tags: ["命主星", "ASC", "Lagna"],
    title: "命主星概念",
    text: "命主星即命宫/上升所在星座的守护星。命主星强弱、落宫、相位决定一生格局基调。命主强而吉则一生顺遂，弱而凶则多波折。",
    source: "通用规则",
  },
];
