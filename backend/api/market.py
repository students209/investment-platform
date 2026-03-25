"""
行情 API
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import akshare as ak

router = APIRouter()

class KLineData(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float

class StockQuote(BaseModel):
    code: str
    name: str
    price: float
    change: float
    change_pct: float
    volume: float
    amount: float

@router.get("/index")
async def get_index_quote():
    """获取大盘指数行情"""
    try:
        df = ak.stock_zh_index_spot_em()
        # 上证指数、深证成指、创业板、科创50
        indices = df[df['代码'].isin(['000001', '399001', '399006', '000688'])]
        return {
            "success": True,
            "data": indices[['代码', '名称', '最新价', '涨跌幅', '成交量', '成交额']].to_dict('records')
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/stock/{code}")
async def get_stock_quote(code: str):
    """获取个股行情"""
    try:
        df = ak.stock_zh_a_spot_em()
        stock = df[df['代码'] == code]
        if stock.empty:
            return {"success": False, "error": "股票代码不存在"}
        return {
            "success": True,
            "data": stock.iloc[0].to_dict()
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/kline/{code}")
async def get_kline(
    code: str, 
    period: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """获取K线数据"""
    try:
        # 默认日期范围：近一年
        if not end_date:
            end_date = datetime.now().strftime("%Y%m%d")
        if not start_date:
            start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")
        
        df = ak.stock_zh_a_hist(
            symbol=code,
            period=period,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "success": True,
            "data": df.to_dict('records')
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/money-flow/{code}")
async def get_money_flow(code: str):
    """获取资金流向"""
    try:
        df = ak.stock_individual_fund_flow(stock=code)
        return {
            "success": True,
            "data": df.tail(5).to_dict('records')
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/hot-stocks")
async def get_hot_stocks():
    """获取热门股票"""
    try:
        df = ak.stock_zh_a_spot_em()
        # 按涨跌幅排序
        df_sorted = df.nlargest(20, '涨跌幅')
        return {
            "success": True,
            "data": df_sorted[['代码', '名称', '最新价', '涨跌幅', '成交量']].to_dict('records')
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
