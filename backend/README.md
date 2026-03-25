# 投资研究平台 - FastAPI 后端

## 快速启动

```bash
cd ~/investment-platform/backend

# 激活虚拟环境
source venv/bin/activate

# 运行
uvicorn main:app --reload --port 8000
```

## API 文档
启动后访问：http://localhost:8000/docs

## 目录结构

```
backend/
├── main.py           # 入口
├── api/              # API 路由
│   ├── market.py     # 行情
│   ├── factors.py    # 因子
│   └── risk.py       # 风控
├── core/             # 核心配置
├── models/           # 数据模型
├── services/         # 业务逻辑
└── utils/            # 工具
```
