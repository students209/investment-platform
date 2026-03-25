"""
论文转因子 API
"""
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import anthropic
import os

router = APIRouter()

class PaperConvertRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None
    filename: Optional[str] = None

class Factor(BaseModel):
    name: str
    description: str
    params: list

class ConvertResult(BaseModel):
    title: str
    part1: str
    part2: str
    factors: list[Factor]

# Anthropic API Key
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """你是一名顶级的量化策略分析师与量化开发工程师。你的任务是接收投资研究报告、金融论文或策略分析文章，输出一份严谨、结构化的深度分析报告，并进一步将文章中的所有投资策略编写为相关的量化因子表达式。

## 分析报告格式模板

### 第一部分：文献核心内容解读

**1. 标题**
* [完整的标题]

**2. 摘要**
* [精准概括的报告摘要]

**3. 核心观点**
* [分点列举关键发现、创新或核心论证]
    * 观点一...
    * 观点二...

**4. 总结**
* [综合总结研究价值和实践意义]

### 第二部分：投资策略深度解析

**策略：[策略的描述性名称]**

**1. 策略描述 (Strategy Description)**
* **投资宇宙:** 可投资资产/证券范围。
* **核心思想:** 基本投资逻辑和市场理念。
* **详细规则:**
    * **买入规则:** 具体建仓条件。
    * **卖出规则:** 具体平仓条件。
    * **调仓频率:** 再平衡的频率。

**2. 回测逻辑与关键指标**
* **所需数据:** 执行回测必需的数据集。
* **关键参数:**
| 参数名称 | 符号 | 描述 | 默认值 |
| :--- | :--- | :--- | :--- |
| 回看期 | N | 时间窗口 | 20 |

* **执行步骤:** 有序列表描述调仓周期内的具体操作流程。

### 第三部分：因子表达式脚本

基于上述分析报告，生成 Python 因子表达式代码。

```python
def alpha_trend_001(df, params=None):
    '''
    基于XXX策略的量化因子
    
    Args:
        df: 包含历史行情数据的DataFrame
        params: 参数字典
    
    Returns:
        DataFrame: 包含instrument, date, alpha_trend_001字段
    '''
    # 数据预处理
    df = df.sort_values(['instrument', 'date']).copy()
    
    # 默认参数
    if params is None:
        params = {}
    
    # 计算因子
    # ...
    
    return df[['instrument', 'date', 'alpha_trend_001']]
```

### 输出格式要求

请严格按照以下格式输出：
1. 第一部分：文献核心内容解读
2. 第二部分：投资策略深度解析  
3. 第三部分：因子表达式脚本

对于每个发现的策略，都要生成对应的Python因子代码。"""

@router.post("/convert")
async def convert_paper(
    text: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    论文/文章转因子
    """
    try:
        # 获取输入内容
        content = ""
        filename = "未命名"
        
        if file:
            filename = file.filename or "上传文件"
            content = await file.read()
            if isinstance(content, bytes):
                content = content.decode('utf-8', errors='ignore')
        
        if text:
            content = text
            filename = "粘贴内容"
        
        if not content:
            return {"success": False, "error": "请提供论文内容"}
        
        # 调用 Anthropic API
        if not ANTHROPIC_API_KEY:
            return {
                "success": False, 
                "error": "未配置 ANTHROPIC_API_KEY 环境变量"
            }
        
        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        
        # 截取内容（避免超出token限制）
        max_chars = 100000
        if len(content) > max_chars:
            content = content[:max_chars] + "\n\n[内容已截断...]"
        
        response = await client.messages.create(
            model="claude-opus-4-520261120",
            max_tokens=8000,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f"请分析以下内容并生成报告：\n\n{content}"}
            ]
        )
        
        full_report = response.content[0].text
        
        # 解析报告，提取第一部分、第二部分
        parts = full_report.split("## 第三部分")
        part1_and_part2 = parts[0] if len(parts) > 1 else full_report
        
        # 简单提取因子名称（从代码中提取）
        import re
        factor_names = re.findall(r'def (alpha_\w+)', full_report)
        
        factors = []
        for i, name in enumerate(factor_names[:5]):  # 最多5个因子
            factors.append({
                "name": name,
                "description": f"基于输入内容生成的量化因子 #{i+1}",
                "params": [
                    {"name": "window", "default": 20, "description": "回看周期"}
                ]
            })
        
        # 如果没有找到因子，添加一个默认因子
        if not factors:
            factors.append({
                "name": "alpha_custom_001",
                "description": "基于输入内容生成的量化因子",
                "params": [
                    {"name": "window", "default": 20, "description": "回看周期"}
                ]
            })
        
        # 分离第一部分和第二部分
        part1 = ""
        part2 = ""
        
        if "## 第一部分" in part1_and_part2:
            tmp = part1_and_part2.split("## 第一部分")[1]
            if "## 第二部分" in tmp:
                tmp_parts = tmp.split("## 第二部分")
                part1 = "## 第一部分" + tmp_parts[0]
                part2 = "## 第二部分" + tmp_parts[1]
            else:
                part1 = "## 第一部分" + tmp
                part2 = "## 第二部分\n(解析中...)"
        else:
            part1 = part1_and_part2[:len(part1_and_part2)//2]
            part2 = part1_and_part2[len(part1_and_part2)//2:]
        
        return {
            "success": True,
            "data": {
                "title": f"论文分析报告 - {filename}",
                "part1": part1,
                "part2": part2,
                "factors": factors,
                "raw_content": full_report
            }
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/factors")
async def list_factors():
    """获取已有因子列表"""
    # 从因子库读取
    return {
        "success": True,
        "data": [
            {"name": "alpha_uhl_crossover", "description": "Uhl均线交叉因子"},
            {"name": "alpha_momentum_001", "description": "动量因子"},
        ]
    }
