"""
投资研究平台 - FastAPI 后端入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import market, factors, risk, paper

app = FastAPI(
    title="投资研究平台 API",
    description="量化投研平台后端服务",
    version="0.1.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(market.router, prefix="/api/market", tags=["行情"])
app.include_router(factors.router, prefix="/api/factors", tags=["因子"])
app.include_router(risk.router, prefix="/api/risk", tags=["风控"])
app.include_router(paper.router, prefix="/api/paper", tags=["论文转因子"])

@app.get("/")
async def root():
    return {"message": "投资研究平台 API", "version": "0.1.0"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
