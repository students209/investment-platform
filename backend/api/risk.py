"""
风控 API
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict
import numpy as np

router = APIRouter()

class Holding(BaseModel):
    code: str
    name: str
    shares: int
    cost: float
    current_price: float

class RiskResult(BaseModel):
    total_value: float
    total_cost: float
    total_pnl: float
    total_pnl_pct: float
    var_95: float
    cvar_95: float
    max_drawdown: float
    volatility: float
    concentration: Dict
    alerts: List[str]

@router.post("/portfolio", response_model=RiskResult)
async def calculate_portfolio_risk(holdings: List[Holding]):
    """计算组合风控指标"""
    # 计算持仓数据
    values = [h.shares * h.current_price for h in holdings]
    costs = [h.shares * h.cost for h in holdings]
    
    total_value = sum(values)
    total_cost = sum(costs)
    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0
    
    # 模拟波动率和 VaR
    volatility = np.random.uniform(15, 25)
    var_95 = -total_value * volatility * 1.65 / 100
    cvar_95 = var_95 * 1.2
    max_drawdown = -np.random.uniform(8, 20)
    
    # 集中度分析
    weights = [v / total_value for v in values]
    concentration = {
        "max_weight": max(weights) * 100,
        "top3_weight": sum(sorted(weights, reverse=True)[:3]) * 100
    }
    
    # 生成告警
    alerts = []
    if concentration["max_weight"] > 20:
        alerts.append(f"⚠️ 单票集中度过高: {concentration['max_weight']:.1f}%")
    if abs(max_drawdown) > 15:
        alerts.append(f"⚠️ 最大回撤较大: {max_drawdown:.1f}%")
    if volatility > 22:
        alerts.append(f"⚠️ 组合波动率偏高: {volatility:.1f}%")
    if total_pnl_pct > 20:
        alerts.append(f"📈 浮盈较大，注意获利了结")
    
    if not alerts:
        alerts.append("✅ 各项风控指标正常")
    
    return RiskResult(
        total_value=round(total_value, 2),
        total_cost=round(total_cost, 2),
        total_pnl=round(total_pnl, 2),
        total_pnl_pct=round(total_pnl_pct, 2),
        var_95=round(var_95, 2),
        cvar_95=round(cvar_95, 2),
        max_drawdown=round(max_drawdown, 2),
        volatility=round(volatility, 2),
        concentration={k: round(v, 2) for k, v in concentration.items()},
        alerts=alerts
    )

@router.get("/dashboard")
async def get_risk_dashboard():
    """获取风控仪表盘概览"""
    return {
        "success": True,
        "data": {
            "portfolio": {
                "value": 1250000,
                "pnl": 85000,
                "pnl_pct": 7.3
            },
            "risk_metrics": {
                "var_95": -18500,
                "cvar_95": -22200,
                "max_drawdown": -8.5,
                "volatility": 18.2
            },
            "alerts": [
                {"type": "warning", "message": "贵州茅台集中度 22.5%"},
                {"type": "info", "message": "组合波动率处于正常范围"}
            ]
        }
    }
