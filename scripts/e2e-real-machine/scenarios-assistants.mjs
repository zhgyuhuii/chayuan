// 自动生成（2026-11-21T04:45:35.234Z）—— gen-assistant-scenarios.mjs，勿手编。
// 领域分层抽样助手 agent 回合回归场景：全量 418 / 冒烟 50
export const ASSISTANT_SCENARIOS_ALL = [
  {
    "id": "assistant-catering-0",
    "domain": "catering",
    "domainLabel": "餐饮 / 食品",
    "desc": "领域助手冒烟：餐饮 / 食品 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "catering",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-catering-1",
    "domain": "catering",
    "domainLabel": "餐饮 / 食品",
    "desc": "领域助手冒烟：餐饮 / 食品 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "catering",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-crossborder-0",
    "domain": "crossborder",
    "domainLabel": "跨境电商",
    "desc": "领域助手冒烟：跨境电商 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "crossborder",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-crossborder-1",
    "domain": "crossborder",
    "domainLabel": "跨境电商",
    "desc": "领域助手冒烟：跨境电商 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "crossborder",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-defmob-0",
    "domain": "defmob",
    "domainLabel": "国防动员 / 人防",
    "desc": "领域助手冒烟：国防动员 / 人防 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "defmob",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-defmob-1",
    "domain": "defmob",
    "domainLabel": "国防动员 / 人防",
    "desc": "领域助手冒烟：国防动员 / 人防 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "defmob",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-ecommerce-0",
    "domain": "ecommerce",
    "domainLabel": "电商 / 零售",
    "desc": "领域助手冒烟：电商 / 零售 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "ecommerce",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-ecommerce-1",
    "domain": "ecommerce",
    "domainLabel": "电商 / 零售",
    "desc": "领域助手冒烟：电商 / 零售 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "ecommerce",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-film-0",
    "domain": "film",
    "domainLabel": "影视 / 编剧",
    "desc": "领域助手冒烟：影视 / 编剧 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "film",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-film-1",
    "domain": "film",
    "domainLabel": "影视 / 编剧",
    "desc": "领域助手冒烟：影视 / 编剧 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "film",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-gov-0",
    "domain": "gov",
    "domainLabel": "政务 / 公文",
    "desc": "领域助手冒烟：政务 / 公文 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "gov",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-gov-1",
    "domain": "gov",
    "domainLabel": "政务 / 公文",
    "desc": "领域助手冒烟：政务 / 公文 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "gov",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govdoc-0",
    "domain": "govdoc",
    "domainLabel": "法定公文",
    "desc": "领域助手冒烟：法定公文 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govdoc",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govdoc-1",
    "domain": "govdoc",
    "domainLabel": "法定公文",
    "desc": "领域助手冒烟：法定公文 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govdoc",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govemergency-0",
    "domain": "govemergency",
    "domainLabel": "应急/舆情",
    "desc": "领域助手冒烟：应急/舆情 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govemergency",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govemergency-1",
    "domain": "govemergency",
    "domainLabel": "应急/舆情",
    "desc": "领域助手冒烟：应急/舆情 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govemergency",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govparty-0",
    "domain": "govparty",
    "domainLabel": "党建/党务",
    "desc": "领域助手冒烟：党建/党务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govparty",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govparty-1",
    "domain": "govparty",
    "domainLabel": "党建/党务",
    "desc": "领域助手冒烟：党建/党务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govparty",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govsupervise-0",
    "domain": "govsupervise",
    "domainLabel": "督查/考核",
    "desc": "领域助手冒烟：督查/考核 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govsupervise",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govsupervise-1",
    "domain": "govsupervise",
    "domainLabel": "督查/考核",
    "desc": "领域助手冒烟：督查/考核 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govsupervise",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-homeservice-0",
    "domain": "homeservice",
    "domainLabel": "家政 / 生活服务",
    "desc": "领域助手冒烟：家政 / 生活服务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "homeservice",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-homeservice-1",
    "domain": "homeservice",
    "domainLabel": "家政 / 生活服务",
    "desc": "领域助手冒烟：家政 / 生活服务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "homeservice",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-landscape-0",
    "domain": "landscape",
    "domainLabel": "园林 / 景观",
    "desc": "领域助手冒烟：园林 / 景观 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "landscape",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-landscape-1",
    "domain": "landscape",
    "domainLabel": "园林 / 景观",
    "desc": "领域助手冒烟：园林 / 景观 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "landscape",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-logistics-0",
    "domain": "logistics",
    "domainLabel": "物流 / 供应链",
    "desc": "领域助手冒烟：物流 / 供应链 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "logistics",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-logistics-1",
    "domain": "logistics",
    "domainLabel": "物流 / 供应链",
    "desc": "领域助手冒烟：物流 / 供应链 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "logistics",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-marketing-0",
    "domain": "marketing",
    "domainLabel": "市场营销",
    "desc": "领域助手冒烟：市场营销 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "marketing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-marketing-1",
    "domain": "marketing",
    "domainLabel": "市场营销",
    "desc": "领域助手冒烟：市场营销 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "marketing",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-mildoc-0",
    "domain": "mildoc",
    "domainLabel": "军事公文文电",
    "desc": "领域助手冒烟：军事公文文电 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "mildoc",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-mildoc-1",
    "domain": "mildoc",
    "domainLabel": "军事公文文电",
    "desc": "领域助手冒烟：军事公文文电 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "mildoc",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-millogistics-0",
    "domain": "millogistics",
    "domainLabel": "后勤保障",
    "desc": "领域助手冒烟：后勤保障 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "millogistics",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-millogistics-1",
    "domain": "millogistics",
    "domainLabel": "后勤保障",
    "desc": "领域助手冒烟：后勤保障 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "millogistics",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-procurator-0",
    "domain": "procurator",
    "domainLabel": "检察",
    "desc": "领域助手冒烟：检察 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "procurator",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-procurator-1",
    "domain": "procurator",
    "domainLabel": "检察",
    "desc": "领域助手冒烟：检察 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "procurator",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-service-0",
    "domain": "service",
    "domainLabel": "客服 / 沟通",
    "desc": "领域助手冒烟：客服 / 沟通 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "service",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-service-1",
    "domain": "service",
    "domainLabel": "客服 / 沟通",
    "desc": "领域助手冒烟：客服 / 沟通 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "service",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-studyabroad-0",
    "domain": "studyabroad",
    "domainLabel": "留学 / 移民",
    "desc": "领域助手冒烟：留学 / 移民 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "studyabroad",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-studyabroad-1",
    "domain": "studyabroad",
    "domainLabel": "留学 / 移民",
    "desc": "领域助手冒烟：留学 / 移民 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "studyabroad",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-teaart-0",
    "domain": "teaart",
    "domainLabel": "茶艺",
    "desc": "领域助手冒烟：茶艺 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "teaart",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-teaart-1",
    "domain": "teaart",
    "domainLabel": "茶艺",
    "desc": "领域助手冒烟：茶艺 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "teaart",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-travel-0",
    "domain": "travel",
    "domainLabel": "旅游 / 酒店",
    "desc": "领域助手冒烟：旅游 / 酒店 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "travel",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-travel-1",
    "domain": "travel",
    "domainLabel": "旅游 / 酒店",
    "desc": "领域助手冒烟：旅游 / 酒店 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "travel",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-water-0",
    "domain": "water",
    "domainLabel": "水利 / 水电",
    "desc": "领域助手冒烟：水利 / 水电 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "water",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-water-1",
    "domain": "water",
    "domainLabel": "水利 / 水电",
    "desc": "领域助手冒烟：水利 / 水电 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "water",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-webnovel-0",
    "domain": "webnovel",
    "domainLabel": "网文 / 小说",
    "desc": "领域助手冒烟：网文 / 小说 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "webnovel",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-webnovel-1",
    "domain": "webnovel",
    "domainLabel": "网文 / 小说",
    "desc": "领域助手冒烟：网文 / 小说 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "webnovel",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-academic-0",
    "domain": "academic",
    "domainLabel": "高校 / 科研",
    "desc": "领域助手冒烟：高校 / 科研 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "academic",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-academic-1",
    "domain": "academic",
    "domainLabel": "高校 / 科研",
    "desc": "领域助手冒烟：高校 / 科研 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "academic",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-advertising-0",
    "domain": "advertising",
    "domainLabel": "广告 / 公关会展",
    "desc": "领域助手冒烟：广告 / 公关会展 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "advertising",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-advertising-1",
    "domain": "advertising",
    "domainLabel": "广告 / 公关会展",
    "desc": "领域助手冒烟：广告 / 公关会展 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "advertising",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-appliancerepair-0",
    "domain": "appliancerepair",
    "domainLabel": "家电维修",
    "desc": "领域助手冒烟：家电维修 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "appliancerepair",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-appliancerepair-1",
    "domain": "appliancerepair",
    "domainLabel": "家电维修",
    "desc": "领域助手冒烟：家电维修 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "appliancerepair",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-aviation-0",
    "domain": "aviation",
    "domainLabel": "民航",
    "desc": "领域助手冒烟：民航 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "aviation",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-aviation-1",
    "domain": "aviation",
    "domainLabel": "民航",
    "desc": "领域助手冒烟：民航 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "aviation",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-beverage-0",
    "domain": "beverage",
    "domainLabel": "茶饮 / 咖啡",
    "desc": "领域助手冒烟：茶饮 / 咖啡 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "beverage",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-beverage-1",
    "domain": "beverage",
    "domainLabel": "茶饮 / 咖啡",
    "desc": "领域助手冒烟：茶饮 / 咖啡 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "beverage",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-cultural-0",
    "domain": "cultural",
    "domainLabel": "文创 / 非遗",
    "desc": "领域助手冒烟：文创 / 非遗 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "cultural",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-cultural-1",
    "domain": "cultural",
    "domainLabel": "文创 / 非遗",
    "desc": "领域助手冒烟：文创 / 非遗 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "cultural",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-education-0",
    "domain": "education",
    "domainLabel": "教育 / 教学",
    "desc": "领域助手冒烟：教育 / 教学 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "education",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-education-1",
    "domain": "education",
    "domainLabel": "教育 / 教学",
    "desc": "领域助手冒烟：教育 / 教学 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "education",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-fashion-0",
    "domain": "fashion",
    "domainLabel": "服装 / 时尚",
    "desc": "领域助手冒烟：服装 / 时尚 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "fashion",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-fashion-1",
    "domain": "fashion",
    "domainLabel": "服装 / 时尚",
    "desc": "领域助手冒烟：服装 / 时尚 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "fashion",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-illustration-0",
    "domain": "illustration",
    "domainLabel": "插画 / 设计",
    "desc": "领域助手冒烟：插画 / 设计 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "illustration",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-illustration-1",
    "domain": "illustration",
    "domainLabel": "插画 / 设计",
    "desc": "领域助手冒烟：插画 / 设计 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "illustration",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-instrumentedu-0",
    "domain": "instrumentedu",
    "domainLabel": "乐器教育",
    "desc": "领域助手冒烟：乐器教育 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "instrumentedu",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-instrumentedu-1",
    "domain": "instrumentedu",
    "domainLabel": "乐器教育",
    "desc": "领域助手冒烟：乐器教育 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "instrumentedu",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-judicial-0",
    "domain": "judicial",
    "domainLabel": "法律 / 司法",
    "desc": "领域助手冒烟：法律 / 司法 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "judicial",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-judicial-1",
    "domain": "judicial",
    "domainLabel": "法律 / 司法",
    "desc": "领域助手冒烟：法律 / 司法 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "judicial",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-moving-0",
    "domain": "moving",
    "domainLabel": "搬家 / 货运",
    "desc": "领域助手冒烟：搬家 / 货运 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "moving",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-moving-1",
    "domain": "moving",
    "domainLabel": "搬家 / 货运",
    "desc": "领域助手冒烟：搬家 / 货运 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "moving",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-music-0",
    "domain": "music",
    "domainLabel": "音乐 / 词曲",
    "desc": "领域助手冒烟：音乐 / 词曲 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "music",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-music-1",
    "domain": "music",
    "domainLabel": "音乐 / 词曲",
    "desc": "领域助手冒烟：音乐 / 词曲 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "music",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-realestate-0",
    "domain": "realestate",
    "domainLabel": "房产 / 物业",
    "desc": "领域助手冒烟：房产 / 物业 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "realestate",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-realestate-1",
    "domain": "realestate",
    "domainLabel": "房产 / 物业",
    "desc": "领域助手冒烟：房产 / 物业 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "realestate",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-recycling-0",
    "domain": "recycling",
    "domainLabel": "二手回收",
    "desc": "领域助手冒烟：二手回收 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "recycling",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-recycling-1",
    "domain": "recycling",
    "domainLabel": "二手回收",
    "desc": "领域助手冒烟：二手回收 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "recycling",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-survey-0",
    "domain": "survey",
    "domainLabel": "测绘 / 地理",
    "desc": "领域助手冒烟：测绘 / 地理 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "survey",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-survey-1",
    "domain": "survey",
    "domainLabel": "测绘 / 地理",
    "desc": "领域助手冒烟：测绘 / 地理 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "survey",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-telecom-0",
    "domain": "telecom",
    "domainLabel": "电信 / 通信",
    "desc": "领域助手冒烟：电信 / 通信 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "telecom",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-telecom-1",
    "domain": "telecom",
    "domainLabel": "电信 / 通信",
    "desc": "领域助手冒烟：电信 / 通信 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "telecom",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-veteran-0",
    "domain": "veteran",
    "domainLabel": "退役军人事务",
    "desc": "领域助手冒烟：退役军人事务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "veteran",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-veteran-1",
    "domain": "veteran",
    "domainLabel": "退役军人事务",
    "desc": "领域助手冒烟：退役军人事务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "veteran",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-veterinary-0",
    "domain": "veterinary",
    "domainLabel": "宠物医疗",
    "desc": "领域助手冒烟：宠物医疗 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "veterinary",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-veterinary-1",
    "domain": "veterinary",
    "domainLabel": "宠物医疗",
    "desc": "领域助手冒烟：宠物医疗 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "veterinary",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-banking-0",
    "domain": "banking",
    "domainLabel": "金融 / 投融资",
    "desc": "领域助手冒烟：金融 / 投融资 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "banking",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-banking-1",
    "domain": "banking",
    "domainLabel": "金融 / 投融资",
    "desc": "领域助手冒烟：金融 / 投融资 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "banking",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-bidding-0",
    "domain": "bidding",
    "domainLabel": "招投标",
    "desc": "领域助手冒烟：招投标 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "bidding",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-bidding-1",
    "domain": "bidding",
    "domainLabel": "招投标",
    "desc": "领域助手冒烟：招投标 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "bidding",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-carwash-0",
    "domain": "carwash",
    "domainLabel": "洗车 / 美容",
    "desc": "领域助手冒烟：洗车 / 美容 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "carwash",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-carwash-1",
    "domain": "carwash",
    "domainLabel": "洗车 / 美容",
    "desc": "领域助手冒烟：洗车 / 美容 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "carwash",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-chemical-0",
    "domain": "chemical",
    "domainLabel": "化工 / 材料",
    "desc": "领域助手冒烟：化工 / 材料 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "chemical",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-chemical-1",
    "domain": "chemical",
    "domainLabel": "化工 / 材料",
    "desc": "领域助手冒烟：化工 / 材料 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "chemical",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-data-0",
    "domain": "data",
    "domainLabel": "数据 / 报表",
    "desc": "领域助手冒烟：数据 / 报表 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "data",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-data-1",
    "domain": "data",
    "domainLabel": "数据 / 报表",
    "desc": "领域助手冒烟：数据 / 报表 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "data",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-dentistry-0",
    "domain": "dentistry",
    "domainLabel": "口腔/牙科",
    "desc": "领域助手冒烟：口腔/牙科 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "dentistry",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-dentistry-1",
    "domain": "dentistry",
    "domainLabel": "口腔/牙科",
    "desc": "领域助手冒烟：口腔/牙科 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "dentistry",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-eldercare-0",
    "domain": "eldercare",
    "domainLabel": "养老 / 老年服务",
    "desc": "领域助手冒烟：养老 / 老年服务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "eldercare",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-eldercare-1",
    "domain": "eldercare",
    "domainLabel": "养老 / 老年服务",
    "desc": "领域助手冒烟：养老 / 老年服务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "eldercare",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-finance-0",
    "domain": "finance",
    "domainLabel": "财务 / 会计",
    "desc": "领域助手冒烟：财务 / 会计 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "finance",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-finance-1",
    "domain": "finance",
    "domainLabel": "财务 / 会计",
    "desc": "领域助手冒烟：财务 / 会计 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "finance",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-floral-0",
    "domain": "floral",
    "domainLabel": "花艺 / 鲜花",
    "desc": "领域助手冒烟：花艺 / 鲜花 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "floral",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-floral-1",
    "domain": "floral",
    "domainLabel": "花艺 / 鲜花",
    "desc": "领域助手冒烟：花艺 / 鲜花 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "floral",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-franchise-0",
    "domain": "franchise",
    "domainLabel": "招商加盟",
    "desc": "领域助手冒烟：招商加盟 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "franchise",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-franchise-1",
    "domain": "franchise",
    "domainLabel": "招商加盟",
    "desc": "领域助手冒烟：招商加盟 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "franchise",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-goveconomy-0",
    "domain": "goveconomy",
    "domainLabel": "经济/营商",
    "desc": "领域助手冒烟：经济/营商 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "goveconomy",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-goveconomy-1",
    "domain": "goveconomy",
    "domainLabel": "经济/营商",
    "desc": "领域助手冒烟：经济/营商 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "goveconomy",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govgrassroots-0",
    "domain": "govgrassroots",
    "domainLabel": "基层治理",
    "desc": "领域助手冒烟：基层治理 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govgrassroots",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govgrassroots-1",
    "domain": "govgrassroots",
    "domainLabel": "基层治理",
    "desc": "领域助手冒烟：基层治理 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govgrassroots",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govpeople-0",
    "domain": "govpeople",
    "domainLabel": "政协人大/统战",
    "desc": "领域助手冒烟：政协人大/统战 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govpeople",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govpeople-1",
    "domain": "govpeople",
    "domainLabel": "政协人大/统战",
    "desc": "领域助手冒烟：政协人大/统战 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govpeople",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-greenplant-0",
    "domain": "greenplant",
    "domainLabel": "绿植 / 园艺",
    "desc": "领域助手冒烟：绿植 / 园艺 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "greenplant",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-greenplant-1",
    "domain": "greenplant",
    "domainLabel": "绿植 / 园艺",
    "desc": "领域助手冒烟：绿植 / 园艺 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "greenplant",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-homedecor-0",
    "domain": "homedecor",
    "domainLabel": "家居 / 建材",
    "desc": "领域助手冒烟：家居 / 建材 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "homedecor",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-homedecor-1",
    "domain": "homedecor",
    "domainLabel": "家居 / 建材",
    "desc": "领域助手冒烟：家居 / 建材 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "homedecor",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-ip-0",
    "domain": "ip",
    "domainLabel": "知识产权",
    "desc": "领域助手冒烟：知识产权 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "ip",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-ip-1",
    "domain": "ip",
    "domainLabel": "知识产权",
    "desc": "领域助手冒烟：知识产权 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "ip",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-justice-0",
    "domain": "justice",
    "domainLabel": "司法行政",
    "desc": "领域助手冒烟：司法行政 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "justice",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-justice-1",
    "domain": "justice",
    "domainLabel": "司法行政",
    "desc": "领域助手冒烟：司法行政 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "justice",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-legal-0",
    "domain": "legal",
    "domainLabel": "合同 / 法务",
    "desc": "领域助手冒烟：合同 / 法务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "legal",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-legal-1",
    "domain": "legal",
    "domainLabel": "合同 / 法务",
    "desc": "领域助手冒烟：合同 / 法务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "legal",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-localfood-0",
    "domain": "localfood",
    "domainLabel": "土特产/食品礼盒",
    "desc": "领域助手冒烟：土特产/食品礼盒 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "localfood",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-localfood-1",
    "domain": "localfood",
    "domainLabel": "土特产/食品礼盒",
    "desc": "领域助手冒烟：土特产/食品礼盒 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "localfood",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-manufacturing-0",
    "domain": "manufacturing",
    "domainLabel": "制造 / 工程",
    "desc": "领域助手冒烟：制造 / 工程 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "manufacturing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-manufacturing-1",
    "domain": "manufacturing",
    "domainLabel": "制造 / 工程",
    "desc": "领域助手冒烟：制造 / 工程 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "manufacturing",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-maternal-0",
    "domain": "maternal",
    "domainLabel": "母婴 / 育儿",
    "desc": "领域助手冒烟：母婴 / 育儿 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "maternal",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-maternal-1",
    "domain": "maternal",
    "domainLabel": "母婴 / 育儿",
    "desc": "领域助手冒烟：母婴 / 育儿 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "maternal",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-media-0",
    "domain": "media",
    "domainLabel": "媒体 / 新闻",
    "desc": "领域助手冒烟：媒体 / 新闻 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "media",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-media-1",
    "domain": "media",
    "domainLabel": "媒体 / 新闻",
    "desc": "领域助手冒烟：媒体 / 新闻 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "media",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-medical-0",
    "domain": "medical",
    "domainLabel": "医疗 / 医学",
    "desc": "领域助手冒烟：医疗 / 医学 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "medical",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-medical-1",
    "domain": "medical",
    "domainLabel": "医疗 / 医学",
    "desc": "领域助手冒烟：医疗 / 医学 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "medical",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milpolitical-0",
    "domain": "milpolitical",
    "domainLabel": "政治工作",
    "desc": "领域助手冒烟：政治工作 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milpolitical",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milpolitical-1",
    "domain": "milpolitical",
    "domainLabel": "政治工作",
    "desc": "领域助手冒烟：政治工作 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milpolitical",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-miltraining-0",
    "domain": "miltraining",
    "domainLabel": "训练管理",
    "desc": "领域助手冒烟：训练管理 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "miltraining",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-miltraining-1",
    "domain": "miltraining",
    "domainLabel": "训练管理",
    "desc": "领域助手冒烟：训练管理 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "miltraining",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-nonprofit-0",
    "domain": "nonprofit",
    "domainLabel": "公益 / 社工",
    "desc": "领域助手冒烟：公益 / 社工 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "nonprofit",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-nonprofit-1",
    "domain": "nonprofit",
    "domainLabel": "公益 / 社工",
    "desc": "领域助手冒烟：公益 / 社工 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "nonprofit",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-parenting-0",
    "domain": "parenting",
    "domainLabel": "家庭教育",
    "desc": "领域助手冒烟：家庭教育 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "parenting",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-parenting-1",
    "domain": "parenting",
    "domainLabel": "家庭教育",
    "desc": "领域助手冒烟：家庭教育 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "parenting",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-personal-0",
    "domain": "personal",
    "domainLabel": "个人 / 生活",
    "desc": "领域助手冒烟：个人 / 生活 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "personal",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-personal-1",
    "domain": "personal",
    "domainLabel": "个人 / 生活",
    "desc": "领域助手冒烟：个人 / 生活 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "personal",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-pharmacy-0",
    "domain": "pharmacy",
    "domainLabel": "药店 / 药房",
    "desc": "领域助手冒烟：药店 / 药房 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "pharmacy",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-pharmacy-1",
    "domain": "pharmacy",
    "domainLabel": "药店 / 药房",
    "desc": "领域助手冒烟：药店 / 药房 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "pharmacy",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-photography-0",
    "domain": "photography",
    "domainLabel": "摄影 / 写真",
    "desc": "领域助手冒烟：摄影 / 写真 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "photography",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-photography-1",
    "domain": "photography",
    "domainLabel": "摄影 / 写真",
    "desc": "领域助手冒烟：摄影 / 写真 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "photography",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-podcast-0",
    "domain": "podcast",
    "domainLabel": "播客 / 音频",
    "desc": "领域助手冒烟：播客 / 音频 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "podcast",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-podcast-1",
    "domain": "podcast",
    "domainLabel": "播客 / 音频",
    "desc": "领域助手冒烟：播客 / 音频 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "podcast",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-police-0",
    "domain": "police",
    "domainLabel": "公安 / 治安",
    "desc": "领域助手冒烟：公安 / 治安 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "police",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-police-1",
    "domain": "police",
    "domainLabel": "公安 / 治安",
    "desc": "领域助手冒烟：公安 / 治安 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "police",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-printing-0",
    "domain": "printing",
    "domainLabel": "印刷 / 包装",
    "desc": "领域助手冒烟：印刷 / 包装 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "printing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-printing-1",
    "domain": "printing",
    "domainLabel": "印刷 / 包装",
    "desc": "领域助手冒烟：印刷 / 包装 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "printing",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-psychology-0",
    "domain": "psychology",
    "domainLabel": "心理咨询",
    "desc": "领域助手冒烟：心理咨询 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "psychology",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-psychology-1",
    "domain": "psychology",
    "domainLabel": "心理咨询",
    "desc": "领域助手冒烟：心理咨询 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "psychology",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-recruit-0",
    "domain": "recruit",
    "domainLabel": "招聘 / 猎头",
    "desc": "领域助手冒烟：招聘 / 猎头 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "recruit",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-recruit-1",
    "domain": "recruit",
    "domainLabel": "招聘 / 猎头",
    "desc": "领域助手冒烟：招聘 / 猎头 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "recruit",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-secrecy-0",
    "domain": "secrecy",
    "domainLabel": "保密合规自查（离线）",
    "desc": "领域助手冒烟：保密合规自查（离线） 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "secrecy",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-secrecy-1",
    "domain": "secrecy",
    "domainLabel": "保密合规自查（离线）",
    "desc": "领域助手冒烟：保密合规自查（离线） 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "secrecy",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-security-0",
    "domain": "security",
    "domainLabel": "安防 / 安保",
    "desc": "领域助手冒烟：安防 / 安保 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "security",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-security-1",
    "domain": "security",
    "domainLabel": "安防 / 安保",
    "desc": "领域助手冒烟：安防 / 安保 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "security",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-shortdrama-0",
    "domain": "shortdrama",
    "domainLabel": "短剧 / 微短剧",
    "desc": "领域助手冒烟：短剧 / 微短剧 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "shortdrama",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-shortdrama-1",
    "domain": "shortdrama",
    "domainLabel": "短剧 / 微短剧",
    "desc": "领域助手冒烟：短剧 / 微短剧 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "shortdrama",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-sports-0",
    "domain": "sports",
    "domainLabel": "体育 / 健身",
    "desc": "领域助手冒烟：体育 / 健身 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "sports",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-sports-1",
    "domain": "sports",
    "domainLabel": "体育 / 健身",
    "desc": "领域助手冒烟：体育 / 健身 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "sports",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tea-0",
    "domain": "tea",
    "domainLabel": "茶叶",
    "desc": "领域助手冒烟：茶叶 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tea",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tea-1",
    "domain": "tea",
    "domainLabel": "茶叶",
    "desc": "领域助手冒烟：茶叶 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tea",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tech-0",
    "domain": "tech",
    "domainLabel": "IT / 技术",
    "desc": "领域助手冒烟：IT / 技术 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tech",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tech-1",
    "domain": "tech",
    "domainLabel": "IT / 技术",
    "desc": "领域助手冒烟：IT / 技术 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tech",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-ticketing-0",
    "domain": "ticketing",
    "domainLabel": "票务 / 演出",
    "desc": "领域助手冒烟：票务 / 演出 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "ticketing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-ticketing-1",
    "domain": "ticketing",
    "domainLabel": "票务 / 演出",
    "desc": "领域助手冒烟：票务 / 演出 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "ticketing",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-trade-0",
    "domain": "trade",
    "domainLabel": "外贸 / 跨境",
    "desc": "领域助手冒烟：外贸 / 跨境 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "trade",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-trade-1",
    "domain": "trade",
    "domainLabel": "外贸 / 跨境",
    "desc": "领域助手冒烟：外贸 / 跨境 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "trade",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tutoring-0",
    "domain": "tutoring",
    "domainLabel": "家教/一对一",
    "desc": "领域助手冒烟：家教/一对一 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tutoring",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tutoring-1",
    "domain": "tutoring",
    "domainLabel": "家教/一对一",
    "desc": "领域助手冒烟：家教/一对一 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tutoring",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-verify-0",
    "domain": "verify",
    "domainLabel": "文档核对",
    "desc": "领域助手冒烟：文档核对 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "verify",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-verify-1",
    "domain": "verify",
    "domainLabel": "文档核对",
    "desc": "领域助手冒烟：文档核对 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "verify",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-wedding-0",
    "domain": "wedding",
    "domainLabel": "婚庆 / 活动",
    "desc": "领域助手冒烟：婚庆 / 活动 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "wedding",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-wedding-1",
    "domain": "wedding",
    "domainLabel": "婚庆 / 活动",
    "desc": "领域助手冒烟：婚庆 / 活动 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "wedding",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-agriculture-0",
    "domain": "agriculture",
    "domainLabel": "农林牧渔",
    "desc": "领域助手冒烟：农林牧渔 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "agriculture",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-agriculture-1",
    "domain": "agriculture",
    "domainLabel": "农林牧渔",
    "desc": "领域助手冒烟：农林牧渔 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "agriculture",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-aquatic-0",
    "domain": "aquatic",
    "domainLabel": "游泳 / 水上",
    "desc": "领域助手冒烟：游泳 / 水上 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "aquatic",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-aquatic-1",
    "domain": "aquatic",
    "domainLabel": "游泳 / 水上",
    "desc": "领域助手冒烟：游泳 / 水上 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "aquatic",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-automotive-0",
    "domain": "automotive",
    "domainLabel": "汽车 / 交通",
    "desc": "领域助手冒烟：汽车 / 交通 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "automotive",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-automotive-1",
    "domain": "automotive",
    "domainLabel": "汽车 / 交通",
    "desc": "领域助手冒烟：汽车 / 交通 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "automotive",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-bakery-0",
    "domain": "bakery",
    "domainLabel": "烘焙 / 甜品",
    "desc": "领域助手冒烟：烘焙 / 甜品 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "bakery",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-bakery-1",
    "domain": "bakery",
    "domainLabel": "烘焙 / 甜品",
    "desc": "领域助手冒烟：烘焙 / 甜品 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "bakery",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-cbexpress-0",
    "domain": "cbexpress",
    "domainLabel": "跨境物流",
    "desc": "领域助手冒烟：跨境物流 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "cbexpress",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-cbexpress-1",
    "domain": "cbexpress",
    "domainLabel": "跨境物流",
    "desc": "领域助手冒烟：跨境物流 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "cbexpress",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-community-0",
    "domain": "community",
    "domainLabel": "社区 / 社工",
    "desc": "领域助手冒烟：社区 / 社工 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "community",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-community-1",
    "domain": "community",
    "domainLabel": "社区 / 社工",
    "desc": "领域助手冒烟：社区 / 社工 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "community",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-court-0",
    "domain": "court",
    "domainLabel": "法院 / 审判",
    "desc": "领域助手冒烟：法院 / 审判 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "court",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-court-1",
    "domain": "court",
    "domainLabel": "法院 / 审判",
    "desc": "领域助手冒烟：法院 / 审判 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "court",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-customs-0",
    "domain": "customs",
    "domainLabel": "海关 / 口岸",
    "desc": "领域助手冒烟：海关 / 口岸 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "customs",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-customs-1",
    "domain": "customs",
    "domainLabel": "海关 / 口岸",
    "desc": "领域助手冒烟：海关 / 口岸 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "customs",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-drivingschool-0",
    "domain": "drivingschool",
    "domainLabel": "驾校 / 驾培",
    "desc": "领域助手冒烟：驾校 / 驾培 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "drivingschool",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-drivingschool-1",
    "domain": "drivingschool",
    "domainLabel": "驾校 / 驾培",
    "desc": "领域助手冒烟：驾校 / 驾培 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "drivingschool",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-elearning-0",
    "domain": "elearning",
    "domainLabel": "在线教育",
    "desc": "领域助手冒烟：在线教育 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "elearning",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-elearning-1",
    "domain": "elearning",
    "domainLabel": "在线教育",
    "desc": "领域助手冒烟：在线教育 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "elearning",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-energy-0",
    "domain": "energy",
    "domainLabel": "能源 / 环保",
    "desc": "领域助手冒烟：能源 / 环保 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "energy",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-energy-1",
    "domain": "energy",
    "domainLabel": "能源 / 环保",
    "desc": "领域助手冒烟：能源 / 环保 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "energy",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-foreign-0",
    "domain": "foreign",
    "domainLabel": "外事 / 外交",
    "desc": "领域助手冒烟：外事 / 外交 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "foreign",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-foreign-1",
    "domain": "foreign",
    "domainLabel": "外事 / 外交",
    "desc": "领域助手冒烟：外事 / 外交 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "foreign",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govenviron-0",
    "domain": "govenviron",
    "domainLabel": "生态环境",
    "desc": "领域助手冒烟：生态环境 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govenviron",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govenviron-1",
    "domain": "govenviron",
    "domainLabel": "生态环境",
    "desc": "领域助手冒烟：生态环境 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govenviron",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govmeeting-0",
    "domain": "govmeeting",
    "domainLabel": "会务/综合",
    "desc": "领域助手冒烟：会务/综合 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govmeeting",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govmeeting-1",
    "domain": "govmeeting",
    "domainLabel": "会务/综合",
    "desc": "领域助手冒烟：会务/综合 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govmeeting",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govpersonnel-0",
    "domain": "govpersonnel",
    "domainLabel": "干部/人事",
    "desc": "领域助手冒烟：干部/人事 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govpersonnel",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govpersonnel-1",
    "domain": "govpersonnel",
    "domainLabel": "干部/人事",
    "desc": "领域助手冒烟：干部/人事 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govpersonnel",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govpolicy-0",
    "domain": "govpolicy",
    "domainLabel": "政策法规",
    "desc": "领域助手冒烟：政策法规 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govpolicy",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govpolicy-1",
    "domain": "govpolicy",
    "domainLabel": "政策法规",
    "desc": "领域助手冒烟：政策法规 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govpolicy",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govservice-0",
    "domain": "govservice",
    "domainLabel": "政务服务",
    "desc": "领域助手冒烟：政务服务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govservice",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govservice-1",
    "domain": "govservice",
    "domainLabel": "政务服务",
    "desc": "领域助手冒烟：政务服务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govservice",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govstats-0",
    "domain": "govstats",
    "domainLabel": "统计",
    "desc": "领域助手冒烟：统计 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govstats",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govstats-1",
    "domain": "govstats",
    "domainLabel": "统计",
    "desc": "领域助手冒烟：统计 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govstats",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-hr-0",
    "domain": "hr",
    "domainLabel": "人力资源",
    "desc": "领域助手冒烟：人力资源 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "hr",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-hr-1",
    "domain": "hr",
    "domainLabel": "人力资源",
    "desc": "领域助手冒烟：人力资源 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "hr",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-insurance-0",
    "domain": "insurance",
    "domainLabel": "保险",
    "desc": "领域助手冒烟：保险 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "insurance",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-insurance-1",
    "domain": "insurance",
    "domainLabel": "保险",
    "desc": "领域助手冒烟：保险 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "insurance",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-library-0",
    "domain": "library",
    "domainLabel": "图书馆",
    "desc": "领域助手冒烟：图书馆 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "library",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-library-1",
    "domain": "library",
    "domainLabel": "图书馆",
    "desc": "领域助手冒烟：图书馆 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "library",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-liquor-0",
    "domain": "liquor",
    "domainLabel": "酒水",
    "desc": "领域助手冒烟：酒水 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "liquor",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-liquor-1",
    "domain": "liquor",
    "domainLabel": "酒水",
    "desc": "领域助手冒烟：酒水 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "liquor",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-mcn-0",
    "domain": "mcn",
    "domainLabel": "MCN / 直播",
    "desc": "领域助手冒烟：MCN / 直播 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "mcn",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-mcn-1",
    "domain": "mcn",
    "domainLabel": "MCN / 直播",
    "desc": "领域助手冒烟：MCN / 直播 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "mcn",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milequip-0",
    "domain": "milequip",
    "domainLabel": "装备管理",
    "desc": "领域助手冒烟：装备管理 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milequip",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milequip-1",
    "domain": "milequip",
    "domainLabel": "装备管理",
    "desc": "领域助手冒烟：装备管理 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milequip",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milpersonnel-0",
    "domain": "milpersonnel",
    "domainLabel": "人事兵员",
    "desc": "领域助手冒烟：人事兵员 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milpersonnel",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milpersonnel-1",
    "domain": "milpersonnel",
    "domainLabel": "人事兵员",
    "desc": "领域助手冒烟：人事兵员 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milpersonnel",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milsafety-0",
    "domain": "milsafety",
    "domainLabel": "安全保密",
    "desc": "领域助手冒烟：安全保密 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milsafety",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milsafety-1",
    "domain": "milsafety",
    "domainLabel": "安全保密",
    "desc": "领域助手冒烟：安全保密 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milsafety",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-publishing-0",
    "domain": "publishing",
    "domainLabel": "出版 / 校对",
    "desc": "领域助手冒烟：出版 / 校对 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "publishing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-publishing-1",
    "domain": "publishing",
    "domainLabel": "出版 / 校对",
    "desc": "领域助手冒烟：出版 / 校对 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "publishing",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-salon-0",
    "domain": "salon",
    "domainLabel": "美容美发",
    "desc": "领域助手冒烟：美容美发 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "salon",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-salon-1",
    "domain": "salon",
    "domainLabel": "美容美发",
    "desc": "领域助手冒烟：美容美发 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "salon",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tcmclinic-0",
    "domain": "tcmclinic",
    "domainLabel": "中医理疗",
    "desc": "领域助手冒烟：中医理疗 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tcmclinic",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tcmclinic-1",
    "domain": "tcmclinic",
    "domainLabel": "中医理疗",
    "desc": "领域助手冒烟：中医理疗 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tcmclinic",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-translation-0",
    "domain": "translation",
    "domainLabel": "翻译 / 本地化",
    "desc": "领域助手冒烟：翻译 / 本地化 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "translation",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-translation-1",
    "domain": "translation",
    "domainLabel": "翻译 / 本地化",
    "desc": "领域助手冒烟：翻译 / 本地化 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "translation",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-wellness-0",
    "domain": "wellness",
    "domainLabel": "健康养生",
    "desc": "领域助手冒烟：健康养生 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "wellness",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-wellness-1",
    "domain": "wellness",
    "domainLabel": "健康养生",
    "desc": "领域助手冒烟：健康养生 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "wellness",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-beauty-0",
    "domain": "beauty",
    "domainLabel": "美妆 / 日化",
    "desc": "领域助手冒烟：美妆 / 日化 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "beauty",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-beauty-1",
    "domain": "beauty",
    "domainLabel": "美妆 / 日化",
    "desc": "领域助手冒烟：美妆 / 日化 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "beauty",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-carrental-0",
    "domain": "carrental",
    "domainLabel": "租车",
    "desc": "领域助手冒烟：租车 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "carrental",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-carrental-1",
    "domain": "carrental",
    "domainLabel": "租车",
    "desc": "领域助手冒烟：租车 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "carrental",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-construction-0",
    "domain": "construction",
    "domainLabel": "建筑施工",
    "desc": "领域助手冒烟：建筑施工 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "construction",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-construction-1",
    "domain": "construction",
    "domainLabel": "建筑施工",
    "desc": "领域助手冒烟：建筑施工 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "construction",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-consulting-0",
    "domain": "consulting",
    "domainLabel": "管理咨询",
    "desc": "领域助手冒烟：管理咨询 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "consulting",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-consulting-1",
    "domain": "consulting",
    "domainLabel": "管理咨询",
    "desc": "领域助手冒烟：管理咨询 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "consulting",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-eduadmin-0",
    "domain": "eduadmin",
    "domainLabel": "教育行政",
    "desc": "领域助手冒烟：教育行政 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "eduadmin",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-eduadmin-1",
    "domain": "eduadmin",
    "domainLabel": "教育行政",
    "desc": "领域助手冒烟：教育行政 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "eduadmin",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-examprep-0",
    "domain": "examprep",
    "domainLabel": "考公考研培训",
    "desc": "领域助手冒烟：考公考研培训 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "examprep",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-examprep-1",
    "domain": "examprep",
    "domainLabel": "考公考研培训",
    "desc": "领域助手冒烟：考公考研培训 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "examprep",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-funeral-0",
    "domain": "funeral",
    "domainLabel": "殡葬服务",
    "desc": "领域助手冒烟：殡葬服务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "funeral",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-funeral-1",
    "domain": "funeral",
    "domainLabel": "殡葬服务",
    "desc": "领域助手冒烟：殡葬服务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "funeral",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govindustryit-0",
    "domain": "govindustryit",
    "domainLabel": "工业和信息化",
    "desc": "领域助手冒烟：工业和信息化 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govindustryit",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govindustryit-1",
    "domain": "govindustryit",
    "domainLabel": "工业和信息化",
    "desc": "领域助手冒烟：工业和信息化 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govindustryit",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govmarketreg-0",
    "domain": "govmarketreg",
    "domainLabel": "市场监管",
    "desc": "领域助手冒烟：市场监管 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govmarketreg",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govmarketreg-1",
    "domain": "govmarketreg",
    "domainLabel": "市场监管",
    "desc": "领域助手冒烟：市场监管 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govmarketreg",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govorg-0",
    "domain": "govorg",
    "domainLabel": "组织部",
    "desc": "领域助手冒烟：组织部 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govorg",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govorg-1",
    "domain": "govorg",
    "domainLabel": "组织部",
    "desc": "领域助手冒烟：组织部 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govorg",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govpetition-0",
    "domain": "govpetition",
    "domainLabel": "信访/民生",
    "desc": "领域助手冒烟：信访/民生 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govpetition",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govpetition-1",
    "domain": "govpetition",
    "domainLabel": "信访/民生",
    "desc": "领域助手冒烟：信访/民生 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govpetition",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-jewelry-0",
    "domain": "jewelry",
    "domainLabel": "珠宝 / 钟表",
    "desc": "领域助手冒烟：珠宝 / 钟表 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "jewelry",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-jewelry-1",
    "domain": "jewelry",
    "domainLabel": "珠宝 / 钟表",
    "desc": "领域助手冒烟：珠宝 / 钟表 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "jewelry",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-kb-verify-0",
    "domain": "kb-verify",
    "domainLabel": "知识库对比",
    "desc": "领域助手冒烟：知识库对比 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "kb-verify",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-kb-verify-1",
    "domain": "kb-verify",
    "domainLabel": "知识库对比",
    "desc": "领域助手冒烟：知识库对比 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "kb-verify",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milparty-0",
    "domain": "milparty",
    "domainLabel": "党务纪检",
    "desc": "领域助手冒烟：党务纪检 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milparty",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-milparty-1",
    "domain": "milparty",
    "domainLabel": "党务纪检",
    "desc": "领域助手冒烟：党务纪检 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "milparty",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-museum-0",
    "domain": "museum",
    "domainLabel": "博物馆",
    "desc": "领域助手冒烟：博物馆 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "museum",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-museum-1",
    "domain": "museum",
    "domainLabel": "博物馆",
    "desc": "领域助手冒烟：博物馆 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "museum",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-notary-0",
    "domain": "notary",
    "domainLabel": "公证",
    "desc": "领域助手冒烟：公证 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "notary",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-notary-1",
    "domain": "notary",
    "domainLabel": "公证",
    "desc": "领域助手冒烟：公证 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "notary",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-optical-0",
    "domain": "optical",
    "domainLabel": "眼镜 / 视光",
    "desc": "领域助手冒烟：眼镜 / 视光 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "optical",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-optical-1",
    "domain": "optical",
    "domainLabel": "眼镜 / 视光",
    "desc": "领域助手冒烟：眼镜 / 视光 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "optical",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-organizing-0",
    "domain": "organizing",
    "domainLabel": "收纳整理",
    "desc": "领域助手冒烟：收纳整理 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "organizing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-organizing-1",
    "domain": "organizing",
    "domainLabel": "收纳整理",
    "desc": "领域助手冒烟：收纳整理 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "organizing",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-partyschool-0",
    "domain": "partyschool",
    "domainLabel": "党校",
    "desc": "领域助手冒烟：党校 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "partyschool",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-partyschool-1",
    "domain": "partyschool",
    "domainLabel": "党校",
    "desc": "领域助手冒烟：党校 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "partyschool",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-pet-0",
    "domain": "pet",
    "domainLabel": "宠物",
    "desc": "领域助手冒烟：宠物 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "pet",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-pet-1",
    "domain": "pet",
    "domainLabel": "宠物",
    "desc": "领域助手冒烟：宠物 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "pet",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-prison-0",
    "domain": "prison",
    "domainLabel": "监狱 / 戒毒",
    "desc": "领域助手冒烟：监狱 / 戒毒 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "prison",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-prison-1",
    "domain": "prison",
    "domainLabel": "监狱 / 戒毒",
    "desc": "领域助手冒烟：监狱 / 戒毒 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "prison",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-school-0",
    "domain": "school",
    "domainLabel": "学校管理",
    "desc": "领域助手冒烟：学校管理 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "school",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-school-1",
    "domain": "school",
    "domainLabel": "学校管理",
    "desc": "领域助手冒烟：学校管理 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "school",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-steel-0",
    "domain": "steel",
    "domainLabel": "钢铁冶金",
    "desc": "领域助手冒烟：钢铁冶金 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "steel",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-steel-1",
    "domain": "steel",
    "domainLabel": "钢铁冶金",
    "desc": "领域助手冒烟：钢铁冶金 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "steel",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-textile-0",
    "domain": "textile",
    "domainLabel": "纺织服装",
    "desc": "领域助手冒烟：纺织服装 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "textile",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-textile-1",
    "domain": "textile",
    "domainLabel": "纺织服装",
    "desc": "领域助手冒烟：纺织服装 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "textile",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tradeassoc-0",
    "domain": "tradeassoc",
    "domainLabel": "行业协会 / 商会",
    "desc": "领域助手冒烟：行业协会 / 商会 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tradeassoc",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-tradeassoc-1",
    "domain": "tradeassoc",
    "domainLabel": "行业协会 / 商会",
    "desc": "领域助手冒烟：行业协会 / 商会 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "tradeassoc",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-womensfed-0",
    "domain": "womensfed",
    "domainLabel": "妇联",
    "desc": "领域助手冒烟：妇联 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "womensfed",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-womensfed-1",
    "domain": "womensfed",
    "domainLabel": "妇联",
    "desc": "领域助手冒烟：妇联 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "womensfed",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-arbitration-0",
    "domain": "arbitration",
    "domainLabel": "仲裁",
    "desc": "领域助手冒烟：仲裁 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "arbitration",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-arbitration-1",
    "domain": "arbitration",
    "domainLabel": "仲裁",
    "desc": "领域助手冒烟：仲裁 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "arbitration",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-cyleague-0",
    "domain": "cyleague",
    "domainLabel": "共青团",
    "desc": "领域助手冒烟：共青团 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "cyleague",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-cyleague-1",
    "domain": "cyleague",
    "domainLabel": "共青团",
    "desc": "领域助手冒烟：共青团 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "cyleague",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-docutil-0",
    "domain": "docutil",
    "domainLabel": "通用文档工具",
    "desc": "领域助手冒烟：通用文档工具 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "docutil",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-docutil-1",
    "domain": "docutil",
    "domainLabel": "通用文档工具",
    "desc": "领域助手冒烟：通用文档工具 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "docutil",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govdevreform-0",
    "domain": "govdevreform",
    "domainLabel": "发展改革",
    "desc": "领域助手冒烟：发展改革 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govdevreform",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govdevreform-1",
    "domain": "govdevreform",
    "domainLabel": "发展改革",
    "desc": "领域助手冒烟：发展改革 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govdevreform",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govdiscipline-0",
    "domain": "govdiscipline",
    "domainLabel": "纪检监察",
    "desc": "领域助手冒烟：纪检监察 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govdiscipline",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govdiscipline-1",
    "domain": "govdiscipline",
    "domainLabel": "纪检监察",
    "desc": "领域助手冒烟：纪检监察 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govdiscipline",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govforestry-0",
    "domain": "govforestry",
    "domainLabel": "林业草原",
    "desc": "领域助手冒烟：林业草原 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govforestry",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govforestry-1",
    "domain": "govforestry",
    "domainLabel": "林业草原",
    "desc": "领域助手冒烟：林业草原 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govforestry",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govnatres-0",
    "domain": "govnatres",
    "domainLabel": "自然资源 / 规划",
    "desc": "领域助手冒烟：自然资源 / 规划 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govnatres",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govnatres-1",
    "domain": "govnatres",
    "domainLabel": "自然资源 / 规划",
    "desc": "领域助手冒烟：自然资源 / 规划 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govnatres",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-hotel-0",
    "domain": "hotel",
    "domainLabel": "酒店",
    "desc": "领域助手冒烟：酒店 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "hotel",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-hotel-1",
    "domain": "hotel",
    "domainLabel": "酒店",
    "desc": "领域助手冒烟：酒店 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "hotel",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-hrservice-0",
    "domain": "hrservice",
    "domainLabel": "人力资源服务",
    "desc": "领域助手冒烟：人力资源服务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "hrservice",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-hrservice-1",
    "domain": "hrservice",
    "domainLabel": "人力资源服务",
    "desc": "领域助手冒烟：人力资源服务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "hrservice",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-preschool-0",
    "domain": "preschool",
    "domainLabel": "学前教育",
    "desc": "领域助手冒烟：学前教育 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "preschool",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-preschool-1",
    "domain": "preschool",
    "domainLabel": "学前教育",
    "desc": "领域助手冒烟：学前教育 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "preschool",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-railway-0",
    "domain": "railway",
    "domainLabel": "铁路",
    "desc": "领域助手冒烟：铁路 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "railway",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-railway-1",
    "domain": "railway",
    "domainLabel": "铁路",
    "desc": "领域助手冒烟：铁路 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "railway",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-rehabilitation-0",
    "domain": "rehabilitation",
    "domainLabel": "康复医疗",
    "desc": "领域助手冒烟：康复医疗 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "rehabilitation",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-rehabilitation-1",
    "domain": "rehabilitation",
    "domainLabel": "康复医疗",
    "desc": "领域助手冒烟：康复医疗 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "rehabilitation",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-specialedu-0",
    "domain": "specialedu",
    "domainLabel": "特殊教育",
    "desc": "领域助手冒烟：特殊教育 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "specialedu",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-specialedu-1",
    "domain": "specialedu",
    "domainLabel": "特殊教育",
    "desc": "领域助手冒烟：特殊教育 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "specialedu",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-union-0",
    "domain": "union",
    "domainLabel": "工会",
    "desc": "领域助手冒烟：工会 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "union",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-union-1",
    "domain": "union",
    "domainLabel": "工会",
    "desc": "领域助手冒烟：工会 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "union",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-accounting-0",
    "domain": "accounting",
    "domainLabel": "会计事务所",
    "desc": "领域助手冒烟：会计事务所 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "accounting",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-accounting-1",
    "domain": "accounting",
    "domainLabel": "会计事务所",
    "desc": "领域助手冒烟：会计事务所 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "accounting",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-arttraining-0",
    "domain": "arttraining",
    "domainLabel": "美术培训",
    "desc": "领域助手冒烟：美术培训 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "arttraining",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-arttraining-1",
    "domain": "arttraining",
    "domainLabel": "美术培训",
    "desc": "领域助手冒烟：美术培训 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "arttraining",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-buildmaterial-0",
    "domain": "buildmaterial",
    "domainLabel": "建材",
    "desc": "领域助手冒烟：建材 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "buildmaterial",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-buildmaterial-1",
    "domain": "buildmaterial",
    "domainLabel": "建材",
    "desc": "领域助手冒烟：建材 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "buildmaterial",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-cdc-0",
    "domain": "cdc",
    "domainLabel": "疾控",
    "desc": "领域助手冒烟：疾控 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "cdc",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-cdc-1",
    "domain": "cdc",
    "domainLabel": "疾控",
    "desc": "领域助手冒烟：疾控 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "cdc",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-costengineer-0",
    "domain": "costengineer",
    "domainLabel": "工程造价",
    "desc": "领域助手冒烟：工程造价 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "costengineer",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-costengineer-1",
    "domain": "costengineer",
    "domainLabel": "工程造价",
    "desc": "领域助手冒烟：工程造价 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "costengineer",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-exhibition-0",
    "domain": "exhibition",
    "domainLabel": "会展",
    "desc": "领域助手冒烟：会展 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "exhibition",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-exhibition-1",
    "domain": "exhibition",
    "domainLabel": "会展",
    "desc": "领域助手冒烟：会展 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "exhibition",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-fitness-0",
    "domain": "fitness",
    "domainLabel": "健身",
    "desc": "领域助手冒烟：健身 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "fitness",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-fitness-1",
    "domain": "fitness",
    "domainLabel": "健身",
    "desc": "领域助手冒烟：健身 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "fitness",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-foodprocess-0",
    "domain": "foodprocess",
    "domainLabel": "食品生产加工",
    "desc": "领域助手冒烟：食品生产加工 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "foodprocess",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-foodprocess-1",
    "domain": "foodprocess",
    "domainLabel": "食品生产加工",
    "desc": "领域助手冒烟：食品生产加工 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "foodprocess",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-fresh-0",
    "domain": "fresh",
    "domainLabel": "生鲜零售",
    "desc": "领域助手冒烟：生鲜零售 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "fresh",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-fresh-1",
    "domain": "fresh",
    "domainLabel": "生鲜零售",
    "desc": "领域助手冒烟：生鲜零售 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "fresh",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govaudit-0",
    "domain": "govaudit",
    "domainLabel": "审计机关",
    "desc": "领域助手冒烟：审计机关 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govaudit",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govaudit-1",
    "domain": "govaudit",
    "domainLabel": "审计机关",
    "desc": "领域助手冒烟：审计机关 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govaudit",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govcivil-0",
    "domain": "govcivil",
    "domainLabel": "民政",
    "desc": "领域助手冒烟：民政 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govcivil",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govcivil-1",
    "domain": "govcivil",
    "domainLabel": "民政",
    "desc": "领域助手冒烟：民政 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govcivil",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govcommerce-0",
    "domain": "govcommerce",
    "domainLabel": "商务",
    "desc": "领域助手冒烟：商务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govcommerce",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govcommerce-1",
    "domain": "govcommerce",
    "domainLabel": "商务",
    "desc": "领域助手冒烟：商务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govcommerce",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govcultour-0",
    "domain": "govcultour",
    "domainLabel": "文旅",
    "desc": "领域助手冒烟：文旅 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govcultour",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govcultour-1",
    "domain": "govcultour",
    "domainLabel": "文旅",
    "desc": "领域助手冒烟：文旅 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govcultour",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govfinance-0",
    "domain": "govfinance",
    "domainLabel": "财政",
    "desc": "领域助手冒烟：财政 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govfinance",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govfinance-1",
    "domain": "govfinance",
    "domainLabel": "财政",
    "desc": "领域助手冒烟：财政 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govfinance",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govhealth-0",
    "domain": "govhealth",
    "domainLabel": "卫生健康",
    "desc": "领域助手冒烟：卫生健康 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govhealth",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govhealth-1",
    "domain": "govhealth",
    "domainLabel": "卫生健康",
    "desc": "领域助手冒烟：卫生健康 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govhealth",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govhotline-0",
    "domain": "govhotline",
    "domainLabel": "12345 热线",
    "desc": "领域助手冒烟：12345 热线 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govhotline",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govhotline-1",
    "domain": "govhotline",
    "domainLabel": "12345 热线",
    "desc": "领域助手冒烟：12345 热线 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govhotline",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govhousing-0",
    "domain": "govhousing",
    "domainLabel": "住建",
    "desc": "领域助手冒烟：住建 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govhousing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govhousing-1",
    "domain": "govhousing",
    "domainLabel": "住建",
    "desc": "领域助手冒烟：住建 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govhousing",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govhrss-0",
    "domain": "govhrss",
    "domainLabel": "人力资源社会保障",
    "desc": "领域助手冒烟：人力资源社会保障 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govhrss",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govhrss-1",
    "domain": "govhrss",
    "domainLabel": "人力资源社会保障",
    "desc": "领域助手冒烟：人力资源社会保障 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govhrss",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govtax-0",
    "domain": "govtax",
    "domainLabel": "税务",
    "desc": "领域助手冒烟：税务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govtax",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govtax-1",
    "domain": "govtax",
    "domainLabel": "税务",
    "desc": "领域助手冒烟：税务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govtax",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govtransport-0",
    "domain": "govtransport",
    "domainLabel": "交通运输",
    "desc": "领域助手冒烟：交通运输 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govtransport",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govtransport-1",
    "domain": "govtransport",
    "domainLabel": "交通运输",
    "desc": "领域助手冒烟：交通运输 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govtransport",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govwater-0",
    "domain": "govwater",
    "domainLabel": "水利 / 水务",
    "desc": "领域助手冒烟：水利 / 水务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govwater",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govwater-1",
    "domain": "govwater",
    "domainLabel": "水利 / 水务",
    "desc": "领域助手冒烟：水利 / 水务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govwater",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-industrialpark-0",
    "domain": "industrialpark",
    "domainLabel": "园区运营",
    "desc": "领域助手冒烟：园区运营 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "industrialpark",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-industrialpark-1",
    "domain": "industrialpark",
    "domainLabel": "园区运营",
    "desc": "领域助手冒烟：园区运营 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "industrialpark",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-livestock-0",
    "domain": "livestock",
    "domainLabel": "畜牧养殖",
    "desc": "领域助手冒烟：畜牧养殖 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "livestock",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-livestock-1",
    "domain": "livestock",
    "domainLabel": "畜牧养殖",
    "desc": "领域助手冒烟：畜牧养殖 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "livestock",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-medbeauty-0",
    "domain": "medbeauty",
    "domainLabel": "医疗美容",
    "desc": "领域助手冒烟：医疗美容 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "medbeauty",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-medbeauty-1",
    "domain": "medbeauty",
    "domainLabel": "医疗美容",
    "desc": "领域助手冒烟：医疗美容 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "medbeauty",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-meddevice-0",
    "domain": "meddevice",
    "domainLabel": "医疗器械",
    "desc": "领域助手冒烟：医疗器械 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "meddevice",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-meddevice-1",
    "domain": "meddevice",
    "domainLabel": "医疗器械",
    "desc": "领域助手冒烟：医疗器械 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "meddevice",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-property-0",
    "domain": "property",
    "domainLabel": "物业管理",
    "desc": "领域助手冒烟：物业管理 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "property",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-property-1",
    "domain": "property",
    "domainLabel": "物业管理",
    "desc": "领域助手冒烟：物业管理 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "property",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-safetyprod-0",
    "domain": "safetyprod",
    "domainLabel": "安全生产",
    "desc": "领域助手冒烟：安全生产 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "safetyprod",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-safetyprod-1",
    "domain": "safetyprod",
    "domainLabel": "安全生产",
    "desc": "领域助手冒烟：安全生产 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "safetyprod",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-securities-0",
    "domain": "securities",
    "domainLabel": "证券 / 基金",
    "desc": "领域助手冒烟：证券 / 基金 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "securities",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-securities-1",
    "domain": "securities",
    "domainLabel": "证券 / 基金",
    "desc": "领域助手冒烟：证券 / 基金 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "securities",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-taxagent-0",
    "domain": "taxagent",
    "domainLabel": "代理记账",
    "desc": "领域助手冒烟：代理记账 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "taxagent",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-taxagent-1",
    "domain": "taxagent",
    "domainLabel": "代理记账",
    "desc": "领域助手冒烟：代理记账 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "taxagent",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-university-0",
    "domain": "university",
    "domainLabel": "高校行政",
    "desc": "领域助手冒烟：高校行政 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "university",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-university-1",
    "domain": "university",
    "domainLabel": "高校行政",
    "desc": "领域助手冒烟：高校行政 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "university",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-voccollege-0",
    "domain": "voccollege",
    "domainLabel": "职业院校",
    "desc": "领域助手冒烟：职业院校 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "voccollege",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-voccollege-1",
    "domain": "voccollege",
    "domainLabel": "职业院校",
    "desc": "领域助手冒烟：职业院校 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "voccollege",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-assetappraisal-0",
    "domain": "assetappraisal",
    "domainLabel": "资产评估",
    "desc": "领域助手冒烟：资产评估 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "assetappraisal",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-auction-0",
    "domain": "auction",
    "domainLabel": "拍卖",
    "desc": "领域助手冒烟：拍卖 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "auction",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-disabledfed-0",
    "domain": "disabledfed",
    "domainLabel": "残联",
    "desc": "领域助手冒烟：残联 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "disabledfed",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-examboard-0",
    "domain": "examboard",
    "domainLabel": "招生考试",
    "desc": "领域助手冒烟：招生考试 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "examboard",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-forensic-0",
    "domain": "forensic",
    "domainLabel": "司法鉴定",
    "desc": "领域助手冒烟：司法鉴定 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "forensic",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-furniture-0",
    "domain": "furniture",
    "domainLabel": "家具",
    "desc": "领域助手冒烟：家具 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "furniture",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govagrirural-0",
    "domain": "govagrirural",
    "domainLabel": "农业农村",
    "desc": "领域助手冒烟：农业农村 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govagrirural",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govarchive-0",
    "domain": "govarchive",
    "domainLabel": "档案",
    "desc": "领域助手冒烟：档案 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govarchive",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govmedicare-0",
    "domain": "govmedicare",
    "domainLabel": "医保",
    "desc": "领域助手冒烟：医保 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govmedicare",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govpublicity-0",
    "domain": "govpublicity",
    "domainLabel": "宣传部",
    "desc": "领域助手冒烟：宣传部 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govpublicity",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govservicehall-0",
    "domain": "govservicehall",
    "domainLabel": "政务服务大厅",
    "desc": "领域助手冒烟：政务服务大厅 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govservicehall",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govstaffing-0",
    "domain": "govstaffing",
    "domainLabel": "机构编制",
    "desc": "领域助手冒烟：机构编制 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govstaffing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govunitedfront-0",
    "domain": "govunitedfront",
    "domainLabel": "统战 / 民宗",
    "desc": "领域助手冒烟：统战 / 民宗 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govunitedfront",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govurbanmgmt-0",
    "domain": "govurbanmgmt",
    "domainLabel": "城管执法",
    "desc": "领域助手冒烟：城管执法 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govurbanmgmt",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govreview-0",
    "domain": "govreview",
    "domainLabel": "政务公文审查",
    "desc": "领域助手冒烟：政务公文审查 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govreview",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-aesthetic-0",
    "domain": "aesthetic",
    "domainLabel": "美业 / 医美",
    "desc": "领域助手冒烟：美业 / 医美 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "aesthetic",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-antique-0",
    "domain": "antique",
    "domainLabel": "古玩 / 收藏",
    "desc": "领域助手冒烟：古玩 / 收藏 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "antique",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-ballsport-0",
    "domain": "ballsport",
    "domainLabel": "球类运动馆",
    "desc": "领域助手冒烟：球类运动馆 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "ballsport",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-bonsai-0",
    "domain": "bonsai",
    "domainLabel": "盆景/根雕",
    "desc": "领域助手冒烟：盆景/根雕 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "bonsai",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-calligraphy-0",
    "domain": "calligraphy",
    "domainLabel": "书法 / 国画",
    "desc": "领域助手冒烟：书法 / 国画 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "calligraphy",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-climbing-0",
    "domain": "climbing",
    "domainLabel": "攀岩/极限运动",
    "desc": "领域助手冒烟：攀岩/极限运动 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "climbing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-coin-0",
    "domain": "coin",
    "domainLabel": "钱币/邮票",
    "desc": "领域助手冒烟：钱币/邮票 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "coin",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-companion-0",
    "domain": "companion",
    "domainLabel": "陪诊/陪护",
    "desc": "领域助手冒烟：陪诊/陪护 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "companion",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-confinement-0",
    "domain": "confinement",
    "domainLabel": "月子 / 母婴护理",
    "desc": "领域助手冒烟：月子 / 母婴护理 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "confinement",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-escaperoom-0",
    "domain": "escaperoom",
    "domainLabel": "密室逃脱",
    "desc": "领域助手冒烟：密室逃脱 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "escaperoom",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-figurine-0",
    "domain": "figurine",
    "domainLabel": "手办 / 潮玩",
    "desc": "领域助手冒烟：手办 / 潮玩 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "figurine",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-funeralpet-0",
    "domain": "funeralpet",
    "domainLabel": "宠物殡葬",
    "desc": "领域助手冒烟：宠物殡葬 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "funeralpet",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-gaming-0",
    "domain": "gaming",
    "domainLabel": "游戏",
    "desc": "领域助手冒烟：游戏 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "gaming",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-hanfu-0",
    "domain": "hanfu",
    "domainLabel": "汉服 / 古风",
    "desc": "领域助手冒烟：汉服 / 古风 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "hanfu",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-incense-0",
    "domain": "incense",
    "domainLabel": "香道/沉香",
    "desc": "领域助手冒烟：香道/沉香 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "incense",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-jade-0",
    "domain": "jade",
    "domainLabel": "玉石/翡翠",
    "desc": "领域助手冒烟：玉石/翡翠 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "jade",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-koi-0",
    "domain": "koi",
    "domainLabel": "观赏鱼/锦鲤",
    "desc": "领域助手冒烟：观赏鱼/锦鲤 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "koi",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-matchmaking-0",
    "domain": "matchmaking",
    "domainLabel": "婚恋 / 相亲",
    "desc": "领域助手冒烟：婚恋 / 相亲 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "matchmaking",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-mounting-0",
    "domain": "mounting",
    "domainLabel": "字画装裱",
    "desc": "领域助手冒烟：字画装裱 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "mounting",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-pottery-0",
    "domain": "pottery",
    "domainLabel": "陶艺 / 手作",
    "desc": "领域助手冒烟：陶艺 / 手作 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "pottery",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-redwood-0",
    "domain": "redwood",
    "domainLabel": "红木家具",
    "desc": "领域助手冒烟：红木家具 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "redwood",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-scriptmurder-0",
    "domain": "scriptmurder",
    "domainLabel": "剧本杀",
    "desc": "领域助手冒烟：剧本杀 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "scriptmurder",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-seal-0",
    "domain": "seal",
    "domainLabel": "篆刻/印章",
    "desc": "领域助手冒烟：篆刻/印章 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "seal",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  }
]
export const ASSISTANT_SCENARIOS_SMOKE = [
  {
    "id": "assistant-catering-0",
    "domain": "catering",
    "domainLabel": "餐饮 / 食品",
    "desc": "领域助手冒烟：餐饮 / 食品 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "catering",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-catering-1",
    "domain": "catering",
    "domainLabel": "餐饮 / 食品",
    "desc": "领域助手冒烟：餐饮 / 食品 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "catering",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-crossborder-0",
    "domain": "crossborder",
    "domainLabel": "跨境电商",
    "desc": "领域助手冒烟：跨境电商 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "crossborder",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-crossborder-1",
    "domain": "crossborder",
    "domainLabel": "跨境电商",
    "desc": "领域助手冒烟：跨境电商 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "crossborder",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-defmob-0",
    "domain": "defmob",
    "domainLabel": "国防动员 / 人防",
    "desc": "领域助手冒烟：国防动员 / 人防 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "defmob",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-defmob-1",
    "domain": "defmob",
    "domainLabel": "国防动员 / 人防",
    "desc": "领域助手冒烟：国防动员 / 人防 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "defmob",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-ecommerce-0",
    "domain": "ecommerce",
    "domainLabel": "电商 / 零售",
    "desc": "领域助手冒烟：电商 / 零售 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "ecommerce",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-ecommerce-1",
    "domain": "ecommerce",
    "domainLabel": "电商 / 零售",
    "desc": "领域助手冒烟：电商 / 零售 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "ecommerce",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-film-0",
    "domain": "film",
    "domainLabel": "影视 / 编剧",
    "desc": "领域助手冒烟：影视 / 编剧 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "film",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-film-1",
    "domain": "film",
    "domainLabel": "影视 / 编剧",
    "desc": "领域助手冒烟：影视 / 编剧 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "film",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-gov-0",
    "domain": "gov",
    "domainLabel": "政务 / 公文",
    "desc": "领域助手冒烟：政务 / 公文 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "gov",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-gov-1",
    "domain": "gov",
    "domainLabel": "政务 / 公文",
    "desc": "领域助手冒烟：政务 / 公文 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "gov",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govdoc-0",
    "domain": "govdoc",
    "domainLabel": "法定公文",
    "desc": "领域助手冒烟：法定公文 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govdoc",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govdoc-1",
    "domain": "govdoc",
    "domainLabel": "法定公文",
    "desc": "领域助手冒烟：法定公文 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govdoc",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govemergency-0",
    "domain": "govemergency",
    "domainLabel": "应急/舆情",
    "desc": "领域助手冒烟：应急/舆情 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govemergency",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govemergency-1",
    "domain": "govemergency",
    "domainLabel": "应急/舆情",
    "desc": "领域助手冒烟：应急/舆情 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govemergency",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govparty-0",
    "domain": "govparty",
    "domainLabel": "党建/党务",
    "desc": "领域助手冒烟：党建/党务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govparty",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govparty-1",
    "domain": "govparty",
    "domainLabel": "党建/党务",
    "desc": "领域助手冒烟：党建/党务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govparty",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govsupervise-0",
    "domain": "govsupervise",
    "domainLabel": "督查/考核",
    "desc": "领域助手冒烟：督查/考核 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govsupervise",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-govsupervise-1",
    "domain": "govsupervise",
    "domainLabel": "督查/考核",
    "desc": "领域助手冒烟：督查/考核 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "govsupervise",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-homeservice-0",
    "domain": "homeservice",
    "domainLabel": "家政 / 生活服务",
    "desc": "领域助手冒烟：家政 / 生活服务 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "homeservice",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-homeservice-1",
    "domain": "homeservice",
    "domainLabel": "家政 / 生活服务",
    "desc": "领域助手冒烟：家政 / 生活服务 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "homeservice",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-landscape-0",
    "domain": "landscape",
    "domainLabel": "园林 / 景观",
    "desc": "领域助手冒烟：园林 / 景观 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "landscape",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-landscape-1",
    "domain": "landscape",
    "domainLabel": "园林 / 景观",
    "desc": "领域助手冒烟：园林 / 景观 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "landscape",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-logistics-0",
    "domain": "logistics",
    "domainLabel": "物流 / 供应链",
    "desc": "领域助手冒烟：物流 / 供应链 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "logistics",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-logistics-1",
    "domain": "logistics",
    "domainLabel": "物流 / 供应链",
    "desc": "领域助手冒烟：物流 / 供应链 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "logistics",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-marketing-0",
    "domain": "marketing",
    "domainLabel": "市场营销",
    "desc": "领域助手冒烟：市场营销 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "marketing",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-marketing-1",
    "domain": "marketing",
    "domainLabel": "市场营销",
    "desc": "领域助手冒烟：市场营销 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "marketing",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-mildoc-0",
    "domain": "mildoc",
    "domainLabel": "军事公文文电",
    "desc": "领域助手冒烟：军事公文文电 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "mildoc",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-mildoc-1",
    "domain": "mildoc",
    "domainLabel": "军事公文文电",
    "desc": "领域助手冒烟：军事公文文电 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "mildoc",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-millogistics-0",
    "domain": "millogistics",
    "domainLabel": "后勤保障",
    "desc": "领域助手冒烟：后勤保障 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "millogistics",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-millogistics-1",
    "domain": "millogistics",
    "domainLabel": "后勤保障",
    "desc": "领域助手冒烟：后勤保障 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "millogistics",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-procurator-0",
    "domain": "procurator",
    "domainLabel": "检察",
    "desc": "领域助手冒烟：检察 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "procurator",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-procurator-1",
    "domain": "procurator",
    "domainLabel": "检察",
    "desc": "领域助手冒烟：检察 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "procurator",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-service-0",
    "domain": "service",
    "domainLabel": "客服 / 沟通",
    "desc": "领域助手冒烟：客服 / 沟通 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "service",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-service-1",
    "domain": "service",
    "domainLabel": "客服 / 沟通",
    "desc": "领域助手冒烟：客服 / 沟通 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "service",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-studyabroad-0",
    "domain": "studyabroad",
    "domainLabel": "留学 / 移民",
    "desc": "领域助手冒烟：留学 / 移民 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "studyabroad",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-studyabroad-1",
    "domain": "studyabroad",
    "domainLabel": "留学 / 移民",
    "desc": "领域助手冒烟：留学 / 移民 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "studyabroad",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-teaart-0",
    "domain": "teaart",
    "domainLabel": "茶艺",
    "desc": "领域助手冒烟：茶艺 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "teaart",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-teaart-1",
    "domain": "teaart",
    "domainLabel": "茶艺",
    "desc": "领域助手冒烟：茶艺 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "teaart",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-travel-0",
    "domain": "travel",
    "domainLabel": "旅游 / 酒店",
    "desc": "领域助手冒烟：旅游 / 酒店 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "travel",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-travel-1",
    "domain": "travel",
    "domainLabel": "旅游 / 酒店",
    "desc": "领域助手冒烟：旅游 / 酒店 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "travel",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-water-0",
    "domain": "water",
    "domainLabel": "水利 / 水电",
    "desc": "领域助手冒烟：水利 / 水电 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "water",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-water-1",
    "domain": "water",
    "domainLabel": "水利 / 水电",
    "desc": "领域助手冒烟：水利 / 水电 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "water",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-webnovel-0",
    "domain": "webnovel",
    "domainLabel": "网文 / 小说",
    "desc": "领域助手冒烟：网文 / 小说 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "webnovel",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-webnovel-1",
    "domain": "webnovel",
    "domainLabel": "网文 / 小说",
    "desc": "领域助手冒烟：网文 / 小说 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "webnovel",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-academic-0",
    "domain": "academic",
    "domainLabel": "高校 / 科研",
    "desc": "领域助手冒烟：高校 / 科研 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "academic",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-academic-1",
    "domain": "academic",
    "domainLabel": "高校 / 科研",
    "desc": "领域助手冒烟：高校 / 科研 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "academic",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-advertising-0",
    "domain": "advertising",
    "domainLabel": "广告 / 公关会展",
    "desc": "领域助手冒烟：广告 / 公关会展 第 1 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "advertising",
      "slot": 0
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  },
  {
    "id": "assistant-advertising-1",
    "domain": "advertising",
    "domainLabel": "广告 / 公关会展",
    "desc": "领域助手冒烟：广告 / 公关会展 第 2 个助手（分层抽样 per-domain=2）",
    "selectProbe": {
      "domain": "advertising",
      "slot": 1
    },
    "expect": {
      "lane": "agent",
      "writeOrAnswer": true
    }
  }
]
export default ASSISTANT_SCENARIOS_SMOKE
