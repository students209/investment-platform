"""
资金流看板 - 三源共振信号 API
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime
import os
import glob
import pandas as pd

router = APIRouter()

# 数据路径配置
EAST_DATA_ROOT = "/Users/alpha/Documents/learn/quant/资金流看板2.0/data/东财"
THS_DATA_ROOT = "/Users/alpha/Documents/learn/quant/资金流看板"
OUTPUT_HTML = "/Users/alpha/Documents/learn/quant/资金流看板2.0/output/资金流看板2.0_latest.html"


def clean_num(v):
    """清洗数值"""
    if pd.isna(v) or v == '' or v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        s = str(v).replace(',', '').strip()
        if '亿' in s:
            return float(s.replace('亿', ''))
        return float(s)
    except:
        return 0.0


def get_latest_file(folder: str, prefix: str = "") -> Optional[str]:
    """获取最新文件"""
    if not os.path.exists(folder):
        return None
    pattern = f"{folder}/*{prefix}*.xlsx"
    files = glob.glob(pattern)
    if not files:
        return None
    # 按修改时间排序
    files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    return files[0]


def read_excel(file_path: str) -> Optional[pd.DataFrame]:
    """读取Excel文件"""
    if not file_path or not os.path.exists(file_path):
        return None
    try:
        df = pd.read_excel(file_path)
        return df
    except Exception as e:
        print(f"读取Excel失败 {file_path}: {e}")
        return None


class SignalsResponse(BaseModel):
    """信号响应"""
    success: bool = True
    signals: dict = {}
    dashboard: dict = {}
    data_source: dict = {}


@router.get("/signals", response_model=SignalsResponse)
async def get_three_source_signals():
    """获取三源共振信号"""
    
    # 初始化信号
    signals = {
        "three_source": {"status": "无信号", "score": 0, "details": []},
        "north": {"value": 0, "direction": "持平", "label": ""},
        "super_large": {"value": 0, "direction": "持平", "label": ""},
        "ths": {"net_inflow": 0, "direction": "持平", "label": ""},
        "margin": {"ratio": 0, "status": "正常", "label": ""},
        "zt": {"count": 0, "consecutive_count": 0, "label": "🔥 涨停 0只"},
        "lhb": {"institution_buy": 0, "status": "持平", "label": ""},
    }
    
    try:
        # 1. 北向资金
        north_file = get_latest_file(f"{EAST_DATA_ROOT}/北向资金/历史", "北向资金历史")
        if north_file:
            df = read_excel(north_file)
            if df is not None and len(df) > 0:
                nc = '当日成交净买额'
                if nc in df.columns:
                    for i in range(len(df) - 1, -1, -1):
                        v = clean_num(df.iloc[i][nc])
                        if v != 0:
                            signals["north"]["value"] = v
                            signals["north"]["direction"] = "买入" if v > 30 else "卖出" if v < -20 else "持平"
                            signals["north"]["label"] = f"🌊 北向 {v:+.1f}亿"
                            break
        
        # 2. 超大单资金流
        mflow_file = get_latest_file(f"{EAST_DATA_ROOT}/市场资金流总览", "市场资金流总览")
        if mflow_file:
            df = read_excel(mflow_file)
            if df is not None and len(df) > 0:
                sc = next((c for c in df.columns if '超大单净流入-净额' in c), None)
                if sc:
                    raw_val = clean_num(df.iloc[-1][sc])
                    val = raw_val / 100000000  # 转换为亿
                    signals["super_large"]["value"] = val
                    signals["super_large"]["direction"] = "流入" if val > 50 else "流出" if val < -30 else "持平"
                    signals["super_large"]["label"] = f"🧠 超大单 {val:+.1f}亿"
        
        # 3. 同花顺主力净流入
        ths_dir = f"{THS_DATA_ROOT}/资金流"
        if os.path.exists(ths_dir):
            ths_files = [f for f in os.listdir(ths_dir) if '板块' in f and '即时' in f and f.endswith('.xlsx')]
            if ths_files:
                ths_file = os.path.join(ths_dir, sorted(ths_files, reverse=True)[0])
                df = read_excel(ths_file)
                if df is not None and len(df) > 0:
                    nc = next((c for c in df.columns if '净额' in c), None)
                    if nc:
                        net_inflow = df[nc].apply(clean_num).sum()
                        signals["ths"]["net_inflow"] = net_inflow
                        val_yi = net_inflow / 10000  # 转换为亿
                        signals["ths"]["direction"] = "流入" if val_yi > 100 else "流出" if val_yi < -50 else "持平"
                        signals["ths"]["label"] = f"📊 主力 {val_yi:+.1f}亿"
        
        # 4. 三源共振判断
        n = signals["north"]["value"]
        s = signals["super_large"]["value"]
        t = signals["ths"]["net_inflow"] / 10000  # 转换为亿
        
        if n > 30 and s > 50 and t > 100:
            signals["three_source"]["status"] = "做多"
            signals["three_source"]["score"] = 100
            signals["three_source"]["details"] = ["北向资金大幅净买入", "超大单机构资金主导", "主力资金持续净流入"]
        elif n < -20 and s < -30 and t < -50:
            signals["three_source"]["status"] = "做空"
            signals["three_source"]["score"] = 100
            signals["three_source"]["details"] = ["北向资金大幅净卖出", "超大单机构资金减仓", "主力资金持续净流出"]
        elif (n > 30 and s > 50) or (n > 30 and t > 100) or (s > 50 and t > 100):
            signals["three_source"]["status"] = "二源共振"
            signals["three_source"]["score"] = 66
            signals["three_source"]["details"] = ["两源同向，信号较强"]
        elif (n > 30 and s < -30) or (s > 50 and t < -50):
            signals["three_source"]["status"] = "背离"
            signals["three_source"]["score"] = 30
            signals["three_source"]["details"] = ["⚠️ 三源信号背离，可能存在拉高出货风险"]
        
        # 5. 融资融券比
        margin_file = get_latest_file(f"{EAST_DATA_ROOT}/融资融券", "融资融券_上交所_历史")
        if margin_file:
            df = read_excel(margin_file)
            if df is not None and len(df) > 0:
                last_row = df.iloc[-1]
                inc = next((c for c in df.columns if '融资余额' in c), None)
                outc = next((c for c in df.columns if '融券余额' in c), None)
                if inc and outc:
                    in_v = clean_num(last_row[inc])
                    out_v = clean_num(last_row[outc])
                    ratio = in_v / out_v if out_v > 0 else 0
                    signals["margin"]["ratio"] = ratio
                    signals["margin"]["status"] = "偏高" if ratio > 3 else "偏低" if ratio < 1.5 else "正常"
                    signals["margin"]["label"] = f"💳 融资/融券比 {ratio:.1f}"
        
        # 6. 涨跌停池
        zt_file = get_latest_file(f"{EAST_DATA_ROOT}/涨跌停池", "")
        if zt_file:
            df = read_excel(zt_file)
            if df is not None:
                signals["zt"]["count"] = len(df)
                lc = next((c for c in df.columns if '连板' in c), None)
                if lc:
                    consecutive = len(df[pd.to_numeric(df[lc], errors='coerce') > 1])
                    signals["zt"]["consecutive_count"] = consecutive
                zt_label = f"🔥 涨停 {signals['zt']['count']}只"
                if signals["zt"]["consecutive_count"] > 0:
                    zt_label += f"，连板 {signals['zt']['consecutive_count']} 只"
                signals["zt"]["label"] = zt_label
        
        # 7. 龙虎榜机构席位
        lhb_dir = f"{EAST_DATA_ROOT}/龙虎榜/机构席位"
        if os.path.exists(lhb_dir):
            lhb_files = [f for f in os.listdir(lhb_dir) if f.endswith('.xlsx')]
            if lhb_files:
                lhb_file = os.path.join(lhb_dir, sorted(lhb_files, reverse=True)[0])
                df = read_excel(lhb_file)
                if df is not None and len(df) > 0:
                    nc = next((c for c in df.columns if '机构' in c and '净买' in c), None)
                    if nc:
                        total = df[nc].apply(clean_num).sum() / 100000000  # 转换为亿
                        signals["lhb"]["institution_buy"] = total
                        signals["lhb"]["status"] = "净买入" if total > 5 else "净卖出" if total < -3 else "持平"
                        signals["lhb"]["label"] = f"🏛️ 机构净买入 {total:+.1f}亿"
    
    except Exception as e:
        print(f"信号计算失败: {e}")
        import traceback
        traceback.print_exc()
    
    # 检查看板HTML
    dashboard_exists = os.path.exists(OUTPUT_HTML)
    dashboard_stat = os.stat(OUTPUT_HTML) if dashboard_exists else None
    
    return SignalsResponse(
        success=True,
        signals=signals,
        dashboard={
            "exists": dashboard_exists,
            "last_modified": datetime.fromtimestamp(dashboard_stat.st_mtime).isoformat() if dashboard_stat else None,
            "size": dashboard_stat.st_size if dashboard_stat else 0,
            "url": f"/api/fund-flow/report?filename=资金流看板2.0_latest.html",
        },
        data_source={
            "eastmoney": {
                "root": EAST_DATA_ROOT,
                "market_flow": os.path.exists(f"{EAST_DATA_ROOT}/市场资金流总览"),
                "north_fund": os.path.exists(f"{EAST_DATA_ROOT}/北向资金"),
                "margin": os.path.exists(f"{EAST_DATA_ROOT}/融资融券"),
                "zt_pool": os.path.exists(f"{EAST_DATA_ROOT}/涨跌停池"),
                "lhb": os.path.exists(f"{EAST_DATA_ROOT}/龙虎榜"),
            },
            "tonghuashun": {
                "root": THS_DATA_ROOT,
                "sector_flow": os.path.exists(f"{THS_DATA_ROOT}/资金流"),
            },
        },
    )
