/* =========================================================
 * 《土楼争霸》游戏数据配置
 * 所有数值、文字、图片文件名都集中在这里，改这里就能改游戏。
 * 图片放在 assets/images/ 下，文件名要和这里写的一致；
 * 找不到图片时，游戏会自动用占位图形代替，不会报错。
 * ========================================================= */
window.GAME_DATA = {

  /* ---------- 开场 ---------- */
  intro: {
    background: 'intro/intro_bg.png', midground: 'intro/intro_mid.png',
    foreground: 'intro/intro_fg.png', emblem: 'logo_min_emblem.png',
    title: '土楼争霸', subtitle: 'TULOU CLASH',
    enter: '点击进入', skip: '跳过开场动画', play: '点击任意处开始', loading: '正在加载',
    // 灯笼中心按 960×540 标定，从左右外侧交替向内点亮。
    lanterns: [[50, 392], [917, 392], [116, 392], [852, 392],
               [177, 392], [788, 392], [239, 392], [724, 392]],
    cues: { lanterns: .4, blades: .9, impact: 1.1, shine: 1.7, banner: 1.9, latin: 2.8, end: 3.6 },
    hold: 2, fade: .42, loadTimeout: 12000
  },

  /* ---------- 漳州闯关地图 ---------- */
  levelMap: {
    background: 'map/map_bg.png', frame: 'map/map_node_frame.png', seal: 'map/map_seal.png',
    title: '漳州闯关地图', back: '返回', returnMap: '返回地图', play: '出战！', close: '关闭关卡信息',
    future: '敬请期待', locked: '通关上一关解锁', secret: '隐藏关', mystery: '？',
    cleared: '已通关', open: '已解锁', recommended: '推荐挑战', sealText: '福',
    waveLabel: '波次', bestLabel: '最好成绩', cardLabel: '解锁知识卡', killsLabel: '击败',
    hpLabel: '土楼血量', noBest: '暂无通关成绩', oldBest: '已通关 · 重玩后记录星级',
    noWaves: '待公布', totalLabel: '总星数', totalStar: '★ {stars} / {max}',
    star: '★', emptyStar: '☆', stageTitle: '第{id}关 · {name}',
    stars: { max: 3, half: .5 },
    timing: { unfold: 600, nodeGap: 90, pop: 330, stamp: 440, launch: 510 },
    // 未来关卡只在地图上展示，无战斗数据。缩略图暂用对应地图地标。
    planned: [
      { id: 3, name: '南靖土楼', subtitle: '山间土楼灯火渐起，一场守楼之战正在酝酿。', map: [242, 348], thumb: [19, 55], card: 'tulou' },
      { id: 4, name: '东山岛', subtitle: '海风掠过沙滩，风动石旁传来新的挑战。', map: [849, 393], thumb: [82, 66], card: 'dongshan' },
      { id: 'secret', name: '红色记忆', map: [356, 448], hidden: true, card: 'hongse' }
    ],
    routes: [
      { from: 1, to: 2, control: [[486, 207], [555, 146]] },
      { from: 2, to: 3, control: [[504, 71], [218, 128]] },
      { from: 3, to: 4, control: [[397, 515], [654, 456]] },
      { from: 3, to: 'secret', control: [[264, 401], [309, 441]] }
    ]
  },

  /* ---------- 藏宝阁与戏台教学 ---------- */
  gallery: {
    background: 'gallery/gallery_bg.png', backArt: 'gallery/card_back.png',
    title: '闽南藏宝阁', count: '已收集 {count} / {total}', award: '闽南文化守护者',
    newBadge: '新', seal: '福', locked: '未收集', close: '关闭知识卡详情',
    prev: '上一张', next: '下一张', speak: '🔊 朗读', stop: '停止朗读', lang: 'zh-CN',
    related: '相关关卡', anyLevel: '任意单人关卡', source: '出处 / 待核实',
    pending: '核对事项见介绍中的【待核实】。', unlisted: '出处待补充。',
    puppetUnlocked: '解锁知识卡「漳州布袋木偶戏」，可在闽南藏宝阁查看。',
    slots: [[271, 205], [479, 210], [685, 222], [275, 356], [478, 364], [683, 374]],
    lanterns: [[83, 189], [877, 189]],
    timings: { light: 340, lanternGap: 130, cards: 390, cardGap: 105, fly: 250, turn: 320 },
    swipe: 36
  },
  help: {
    stage: 'help/help_stage.png',
    curtains: ['help/help_curtain_l.png', 'help/help_curtain_r.png'],
    title: '玩法说明', tryIt: '去试试！', curtainMs: 700, pageMs: 245, swipe: 36,
    pages: ['基础玩法', '木偶图鉴', '敌人图鉴', '双人对决', '键位'],
    heroKeys: ['wenguan', 'wujiang', 'chou'], enemyKeys: ['yao', 'kuai', 'big'],
    seal: '福', towerArt: 'tulou.png',
    basics: [
      { title: '选木偶', text: '从底部商店选木偶。电脑也可以按 1 / 2 / 3 快速选择。' },
      { title: '放到石台上', text: '点击空石台放下木偶，消耗福币。敌人进射程后，木偶会自动攻击。' },
      { title: '升级木偶', text: '点击已放置的木偶，花福币升级。伤害、射程与攻击频率都会提升。' },
      { title: '五福临门', text: '击败敌人攒福气。攒满 {need} 点后发动，对全场敌人造成伤害并定身。' }
    ],
    demo: { size: [176, 108], period: 3.6, offsets: [0, .25, .5, .8] },
    cost: '{value} 福币', stats: ['伤害', '射程', '攻速'], hitsPerSecond: '{value} 次/秒',
    enemyStats: ['血量', '速度', '击败奖励'], speed: '{value} 像素/秒',
    tips: {
      yao: '小妖常成群出现，用丑角的鞭炮清理。',
      kuai: '快腿小鬼跑得快，用文官减速。',
      big: '夜叉大汉血厚，在路口集中火力，必要时用大招定身。'
    },
    match: [
      { title: '布阵防守', text: '在己方石台放下或升级木偶，守住自己的土楼。' },
      { title: '派兵进攻', text: '用福币派兵，从{lanes}条路线中选一路，击破对方土楼即获胜。' },
      { title: '限时与加时', text: '正赛 {minutes} 分钟。到时比较血量，平局加时 {overtime} 秒。加时后血量依然相同则判平局。' }
    ],
    diagram: '红金两方的土楼与三条进攻路线',
    keyboard: [
      ['~','1','2','3','4','5','6','7','8','9','0','−','='],
      ['Tab','Q','W','E','R','T','Y','U','I','O','P','[',']'],
      ['Caps','A','S','D','F','G','H','J','K','L',';','Enter'],
      ['Shift','Z','X','C','V','B','N','M',',','.','/','↑'],
      ['Ctrl','Alt','空格','Alt','←','↓','→']
    ],
    keys: {
      L: [
        [['1','2','3'], '选择木偶'], [['A','D'], '切换石台'], [['空格'], '放置 / 升级'],
        [['Q','E','R'], '派小妖 / 小鬼 / 大汉'], [['W','S'], '切换出兵路线'], [['F'], '放大招']
      ],
      R: [
        [['7','8','9'], '选择木偶'], [['←','→'], '切换石台'], [['Enter'], '放置 / 升级'],
        [['I','O','P'], '派小妖 / 小鬼 / 大汉'], [['↑','↓'], '切换出兵路线'], [['L'], '放大招']
      ]
    },
    touch: '手机 / 平板：直接点击屏幕'
  },

  /* ---------- 木偶英雄（防御塔） ---------- */
  // cost: 放置花费（福币）  range: 攻击范围(px)  rate: 攻击间隔(秒)  dmg: 伤害
  // type: single 单体 / slow 减速 / aoe 范围
  heroes: {
    wenguan: {
      name: '文官', short: '文', cost: 40, range: 135, rate: 0.9, dmg: 10,
      type: 'slow', slow: 0.45, slowTime: 1.6,
      color: '#2f6fb0', img: 'hero_wenguan.png',
      desc: '挥扇刮风，命中的敌人会变慢'
    },
    wujiang: {
      name: '武将', short: '武', cost: 50, range: 105, rate: 0.8, dmg: 24,
      type: 'single', melee: true,
      color: '#c8102e', img: 'hero_wujiang.png',
      desc: '大刀横扫，近身伤害最高'
    },
    chou: {
      name: '丑角', short: '丑', cost: 70, range: 125, rate: 1.6, dmg: 14,
      type: 'aoe', splash: 62,
      color: '#d4a017', img: 'hero_chou.png',
      desc: '甩出鞭炮，炸伤一大片'
    }
    // 【Codex 待加】花旦（治疗土楼）、舞狮（坦克/阻挡）、八宝将军（定身）
  },

  upgrade: {
    maxLevel: 3,          // 最高等级
    costRate: 0.8,        // 升级花费 = 放置花费 × 0.8 × 当前等级
    dmgPerLevel: 0.5,     // 每升一级伤害 +50%
    rangePerLevel: 0.1    // 每升一级范围 +10%
  },

  /* ---------- 敌人 ---------- */
  // speed: 移动速度(px/秒)  reward: 击败奖励福币  dmg: 到达土楼扣的血  r: 体型半径
  enemies: {
    yao:  { name: '夜市小妖', hp: 42,  speed: 58,  reward: 6,  dmg: 1, r: 15, color: '#6b4c9a', img: 'enemy_yao.png' },
    kuai: { name: '快腿小鬼', hp: 26,  speed: 112, reward: 5,  dmg: 1, r: 12, color: '#2e8b57', img: 'enemy_kuai.png' },
    big:  { name: '夜叉大汉', hp: 230, speed: 34,  reward: 20, dmg: 3, r: 22, color: '#5a2a2a', img: 'enemy_big.png' }
  },

  /* ---------- 大招：五福临门 ---------- */
  ult: {
    name: '五福临门',
    need: 30,       // 需要攒满多少福气（每击败一个敌人 +1）
    dmg: 90,        // 对全屏敌人造成的伤害
    stun: 1.8       // 定身秒数
  },

  /* ---------- 关卡 ---------- */
  // path: 敌人行走路线的拐点坐标（画布 960×540）
  // slots: 可以放木偶的位置
  // waves: 每一波的敌人组成  { type: 敌人, count: 数量, gap: 出怪间隔秒 }
  levels: [
    {
      id: 1, name: '古城街巷', subtitle: '夜幕降临，小妖混进了古城夜市……',
      map: [409, 220], thumb: [49, 46],
      bg: 'bg_level1.png', theme: 'gucheng',
      startFu: 150, towerHP: 20, hpScale: 1.0,
      // 坐标已按 GPT 画的 bg_level1.png 对齐
      path: [[-40,120],[236,120],[236,385],[501,385],[501,156],[767,156],[767,317],[850,317]],
      slots: [[159,187],[165,310],[311,288],[371,317],[428,220],[580,290],[648,73],[685,239],[841,222]],
      waves: [
        [{ type: 'yao', count: 8, gap: 0.9 }],
        [{ type: 'yao', count: 10, gap: 0.7 }, { type: 'kuai', count: 4, gap: 0.6 }],
        [{ type: 'yao', count: 8, gap: 0.6 }, { type: 'big', count: 2, gap: 2.0 }],
        [{ type: 'kuai', count: 10, gap: 0.45 }, { type: 'yao', count: 8, gap: 0.5 }],
        [{ type: 'yao', count: 12, gap: 0.45 }, { type: 'big', count: 4, gap: 1.6 }, { type: 'kuai', count: 8, gap: 0.4 }]
      ],
      card: 'gucheng'
    },
    {
      id: 2, name: '九龙江边', subtitle: '江上起雾，水怪顺着江岸摸了过来……',
      map: [625, 128], thumb: [50, 54],
      bg: 'bg_level2.png', theme: 'jiang',
      startFu: 200, towerHP: 20, hpScale: 1.12,
      // 按 bg_level2.png 的道路中心线与石台实测，游戏坐标为图片像素的一半
      path: [[-40,433],[193,433],[193,140],[446,140],[446,403],[717,403],[717,117],[872,117]],
      slots: [[106,354],[287,250],[331,78],[368,250],[538,278],[615,325],[788,329],[629,67],[817,250]],
      waves: [
        [{ type: 'yao', count: 10, gap: 0.8 }, { type: 'kuai', count: 4, gap: 0.6 }],
        [{ type: 'kuai', count: 12, gap: 0.45 }],
        [{ type: 'yao', count: 10, gap: 0.55 }, { type: 'big', count: 3, gap: 1.8 }],
        [{ type: 'big', count: 5, gap: 1.4 }, { type: 'kuai', count: 10, gap: 0.4 }],
        [{ type: 'yao', count: 16, gap: 0.35 }, { type: 'big', count: 6, gap: 1.2 }, { type: 'kuai', count: 12, gap: 0.35 }],
        [{ type: 'big', count: 10, gap: 1.0 }, { type: 'yao', count: 20, gap: 0.3 }]
      ],
      card: 'yinni'
    }
  ],

  /* ---------- 漳州文化知识卡 ----------
   * 文字为初稿，标【待核实】的请对照资料确认后再定稿 */
  cards: {
    gucheng: {
      title: '漳州古城', img: 'card_gucheng.png', unlock: '通关「古城街巷」',
      text: '漳州是国家历史文化名城。古城里保留着成片的老街巷和骑楼，牌坊、老字号和闽南小吃都藏在街角。白天逛老街，晚上逛夜市，是漳州最有烟火气的地方。【待核实：可补充具体街名和年代】'
    },
    yinni: {
      title: '八宝印泥', img: 'card_yinni.png', unlock: '通关「九龙江边」',
      text: '漳州八宝印泥是有几百年历史的传统名产，用多种珍贵材料制成，颜色鲜红、经久不褪，盖在书画上多年依然艳丽。它也是国家级非物质文化遗产。【待核实：创制年代与非遗批次】'
    },
    tulou: {
      title: '南靖土楼', img: 'card_tulou.png', unlock: '通关「南靖土楼」（待开发）',
      text: '福建土楼是客家人和闽南人聚族而居的大型夯土建筑，2008 年作为「福建土楼」列入世界文化遗产，南靖的田螺坑土楼群、华安的二宜楼都在其中。一座圆楼就像一座小城，能住下整个家族。'
    },
    muou: {
      title: '漳州布袋木偶戏', img: 'card_muou.png', unlock: '首次放置木偶',
      text: '布袋木偶戏是漳州的传统戏剧，艺人把手伸进布袋做的木偶里表演，一只手就能让木偶开扇、舞刀、翻跟斗。漳州木偶头雕刻精细，是国家级非物质文化遗产。【待核实：非遗批次】'
    },
    dongshan: {
      title: '东山岛', img: 'card_dongshan.png', unlock: '通关「东山岛」（待开发）',
      text: '东山岛是福建第二大岛，有长长的金色沙滩和著名的风动石，海鲜和海景都是一绝。【待核实：可补充风动石、关帝庙等介绍】'
    },
    hongse: {
      title: '红色记忆', img: 'card_hongse.png', unlock: '通关隐藏关（待开发）',
      text: '1932 年，中央红军东路军攻克漳州，这是漳州红色历史中的重要一页。【待核实：请对照党史资料补充完整，隐藏关以剧情 + 答题形式呈现】'
    }
  },

  /* ---------- 双人对决 ---------- */
  versus: {
    duration: 180,        // 正赛时长（秒）
    overtime: 30,         // 平局加时（秒）
    startFu: 100,         // 开局福币
    income: 5,            // 每隔 incomeEvery 秒自动获得的福币
    incomeEvery: 2,
    towerHP: 30,          // 土楼血量
    unitHpScale: 1.0,     // 派出小兵的血量倍数
    bg: 'bg_versus.png',  // 对战地图背景（没有就用占位）
    tulouL: [60, 251],    // 红方土楼
    tulouR: [898, 251],   // 金方土楼
    // 三条路：从红方（左）走向金方（右）；金方的兵沿同一条路反向走
    // 按 bg_versus.png 的道路中心线实测
    lanes: [
      [[108, 211], [178, 93], [779, 93], [851, 211]],
      [[121, 251], [839, 251]],
      [[108, 289], [179, 407], [778, 407], [851, 288]]
    ],
    laneNames: ['上路', '中路', '下路'],
    // 对战背景的石台略有偏差，两侧分别按实测配置
    slotsL: [[199, 175], [326, 167], [430, 193], [200, 327], [325, 327], [430, 310]],
    slotsR: [[756, 175], [630, 167], [526, 193], [755, 327], [630, 327], [525, 310]],
    // 派兵花费（属性沿用上面 enemies 里的数值）
    units: { yao: { cost: 15 }, kuai: { cost: 12 }, big: { cost: 45 } },
    teams: {
      L: { name: '红方', color: '#c8102e' },
      R: { name: '金方', color: '#d4a017' }
    }
  },

  /* ---------- 电竞福签 ---------- */
  blessings: [
    '好势好势，福气满满', '爱拼敢赢，土楼稳稳',
    '步步好势，日日有福', '一声厉害喔，满桌好彩头',
    '拍拼有收成，福气满门庭', '红灯照前路，好运跟着走',
    '福到古城，好运到厝', '今日好势，明日更旺',
    '一签纳百福，土楼保平安', '灯火映九龙江，福气落漳州'
  ],
  fortune: {
    width: 1080, height: 1920, logo: 'logo.png', footerLogo: 'logo_round.png', offlineArt: 'js/fortune-art.js',
    title: '电竞福签', button: '生成福签', generating: '正在生成…',
    download: '下载图片', touchHint: '长按图片保存', close: '关闭',
    failed: '福签生成失败，请再试一次。',
    game: '土楼争霸', signature: '漳州 · 电竞+ · 土楼争霸', stamp: '福',
    filename: '福签_{date}.png', mvp: '本局MVP：{hero} · 造成 {damage} 点伤害',
    noMvp: '本局MVP：暂无', teamMvp: 'MVP · {hero}', noTeamMvp: 'MVP · 暂无',
    damage: '造成 {damage} 点伤害', level: '关卡', kills: '击败数',
    hp: '剩余土楼血量', outcome: '通关结果', cleared: '已通关', lost: '未通关',
    duel: '{left} vs {right}', winner: '胜方：{team}', draw: '平局', sent: '派兵数'
  },

  /* ---------- 解说字幕 ---------- */
  narration: {
    avatar: 'commentator.png', placeholder: '🎙', on: '解说：开', off: '解说：关',
    holdMs: 2600, lowHpRatio: 0.30, streakCount: 5, streakSeconds: 3,
    bigSendCount: 3, finalSeconds: 10,
    highPriority: ['lowHp', 'ult', 'win', 'lose', 'fullWin', 'comeback', 'vsLow', 'vsUlt', 'vsWin', 'vsDraw', 'vsOvertime'],
    featured: ['firstChou', 'towerStreak', 'vsBigStreak', 'vsTied', 'vsFinalSeconds']
  },
  commentary: {
    waveStart:  ['新一波敌人来了，各位木偶准备！', '注意注意，对面开始进攻了！', '这一波来势汹汹，看你怎么守！'],
    multiKill:  ['丑角一串鞭炮，直接团灭！好势！', '漂亮！一波收割，福币到手！', '这操作，厉害喔！', '连续击败！土楼稳如泰山！'],
    lowHp:      ['土楼只剩一点血了，这波危了！', '顶住啊！再漏怪就要输了！', '关键时刻，大招准备好了没？'],
    ult:        ['五福临门！全屏定身！', '福气满满，一招清场！', '大招来了！这就是闽南的福气！'],
    place:      ['新木偶上场，布阵开始！', '这个位置选得好！'],
    upgrade:    ['木偶升级，火力全开！', '升级完成，越打越强！'],
    leak:       ['漏了一个！土楼掉血了！', '哎呀，有小妖溜进去了！'],
    win:        ['守住了！土楼岿然不动！', '胜利！这才是电竞拍拼精神！'],
    lose:       ['土楼失守……调整阵型再来一次！'],
    firstChou:  ['丑角头一回登场，鞭炮一响，好势喔！', '看这丑角笑嘻嘻，等下鞭炮响连天！', '丑角就位！这串鞭炮拍拼起来，厉害喔！'],
    towerStreak: ['{hero}大杀特杀！三秒五连击败，厉害喔！', '好势！{hero}大杀特杀，五个敌人接连倒下！', '{hero}大杀特杀！这波拍拼，三秒收下五个！'],
    fullWin:    ['一滴血没掉！土楼稳稳，好势喔！', '满血通关！这布阵厉害喔！', '拍拼一整局，土楼满血迎来胜利！'],
    comeback:   ['残血翻盘！拍拼到最后，咱守住啦！', '土楼都快倒了还能翻盘，厉害喔！', '从残血守到通关，好势！这把够硬气！'],
    // 对战专用，{team} 会替换成红方/金方
    vsStart:    ['双方土楼就位，比赛开始！', '闽南杯对决，开战！'],
    vsSendBig:  ['{team}派出夜叉大汉，这波要强攻了！', '{team}憋了一个大的！'],
    vsLow:      ['{team}土楼告急！', '{team}快顶不住了！这波危了！'],
    vsUlt:      ['{team}五福临门！半场清空！', '{team}大招开了，福气满满！'],
    vsKills:    ['{team}一波收割，好势！', '{team}防守滴水不漏！'],
    vsOvertime: ['时间到，比分持平，进入加时赛！'],
    vsWin:      ['{team}拿下比赛！这才是电竞拍拼精神！', '恭喜{team}，土楼争霸冠军！'],
    vsDraw:     ['加时也分不出胜负，双方打平！'],
    vsBigStreak: ['{team}连派三个夜叉大汉！这波拍拼下重本喔！', '{team}三大汉接力出阵，对面顶得住吗？', '厉害喔！{team}一口气派了三个夜叉大汉！'],
    vsTied:      ['两边土楼血量追平了！这下有戏喔！', '比分追平！接下来谁先抢到好势？', '土楼血量一样了，双方还在拍拼！'],
    vsFinalSeconds: ['最后十秒！拍拼到这一刻，别松手！', '十秒倒计时！厉害喔，胜负还悬着！', '最后十秒，土楼稳稳才有好势！']
  }
};
