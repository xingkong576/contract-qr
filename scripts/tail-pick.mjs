// 尾盘选股脚本 - 基于Python akshare
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PY_SCRIPT = path.join(__dirname, 'tail_pick.py');

const pythonScript = `
import akshare as ak
import pandas as pd
import json
from datetime import datetime
import sys

# 强制stdout为utf-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def get_market_overview():
    try:
        indices = {
            '上证指数': 'sh000001',
            '深证成指': 'sz399001', 
            '创业板指': 'sz399006',
            '沪深300': 'sh000300',
        }
        result = []
        for name, code in indices.items():
            try:
                df = ak.stock_zh_index_daily(symbol=code)
                if len(df) > 0:
                    latest = df.iloc[-1]
                    prev = df.iloc[-2] if len(df) > 1 else latest
                    change_pct = ((latest['open'] - prev['open']) / prev['open'] * 100) if prev['open'] != 0 else 0
                    result.append({
                        'name': name,
                        'value': round(float(latest['open']), 2),
                        'change': round(float(change_pct), 2)
                    })
            except:
                pass
        return result
    except Exception as e:
        return [{'error': str(e)}]

def get_top_gainers(limit=20):
    try:
        df = ak.stock_zh_a_spot_em()
        df = df[df['代码'].str.startswith(('60', '00'))]
        df = df[~df['名称'].str.contains('ST|退')]
        df = df.sort_values('涨跌幅', ascending=False)
        top = df.head(limit)[['代码', '名称', '最新价', '涨跌幅', '换手率', '成交额', '总市值']]
        records = top.to_dict('records')
        for r in records:
            for k, v in r.items():
                if isinstance(v, (pd.Series, pd.DataFrame)):
                    val = v.values[0] if hasattr(v, 'values') else v
                    try: r[k] = float(val)
                    except: r[k] = None
                elif pd.isna(v):
                    r[k] = None
                else:
                    try: r[k] = float(v)
                    except: pass
        return records
    except Exception as e:
        return [{'error': str(e)}]

def get_fund_flow():
    try:
        df = ak.stock_zh_a_spot_em()
        df = df[df['代码'].str.startswith(('60', '00'))]
        df = df[~df['名称'].str.contains('ST|退')]
        if '主力净流入-净额' in df.columns:
            df = df.sort_values('主力净流入-净额', ascending=False)
            top = df.head(15)[['代码', '名称', '最新价', '涨跌幅', '主力净流入-净额', '主力净流入-净占比']]
        else:
            df = df.sort_values('成交额', ascending=False)
            top = df.head(15)[['代码', '名称', '最新价', '涨跌幅', '成交额', '换手率']]
        records = top.to_dict('records')
        for r in records:
            for k, v in r.items():
                if isinstance(v, (pd.Series, pd.DataFrame)):
                    val = v.values[0] if hasattr(v, 'values') else v
                    try: r[k] = float(val)
                    except: r[k] = None
                elif pd.isna(v):
                    r[k] = None
                else:
                    try: r[k] = float(v)
                    except: pass
        return records
    except Exception as e:
        return [{'error': str(e)}]

def get_sector_hotspots():
    try:
        industry_df = ak.stock_board_industry_name_em()
        industry_df = industry_df.sort_values('涨跌幅', ascending=False)
        industry_top = industry_df.head(10)[['板块名称', '涨跌幅', '总市值', '换手率', '领涨股票', '领涨股票-代码']]
        
        concept_df = ak.stock_board_concept_name_em()
        concept_df = concept_df.sort_values('涨跌幅', ascending=False)
        concept_top = concept_df.head(10)[['板块名称', '涨跌幅', '总市值', '换手率', '领涨股票', '领涨股票-代码']]
        
        def clean_records(df):
            records = df.to_dict('records')
            for r in records:
                for k, v in r.items():
                    if isinstance(v, (pd.Series, pd.DataFrame)):
                        val = v.values[0] if hasattr(v, 'values') else v
                        try: r[k] = float(val)
                        except: r[k] = str(val) if pd.notna(val) else ''
                    elif pd.isna(v):
                        r[k] = ''
                    else:
                        try: r[k] = float(v)
                        except: r[k] = str(v)
            return records
        
        return {
            'industry': clean_records(industry_top),
            'concept': clean_records(concept_top)
        }
    except Exception as e:
        return {'error': str(e)}

def get_limit_up_stocks():
    try:
        df = ak.stock_zh_a_spot_em()
        df = df[df['代码'].str.startswith(('60', '00'))]
        df = df[~df['名称'].str.contains('ST|退')]
        limit_up = df[df['涨跌幅'] >= 9.5]
        if len(limit_up) == 0:
            limit_up = df[df['涨跌幅'] >= 8.0]
        limit_up = limit_up.sort_values('涨跌幅', ascending=False)
        top = limit_up.head(15)[['代码', '名称', '最新价', '涨跌幅', '成交额', '换手率']]
        records = top.to_dict('records')
        for r in records:
            for k, v in r.items():
                if isinstance(v, (pd.Series, pd.DataFrame)):
                    val = v.values[0] if hasattr(v, 'values') else v
                    try: r[k] = float(val)
                    except: r[k] = None
                elif pd.isna(v):
                    r[k] = None
                else:
                    try: r[k] = float(v)
                    except: pass
        return records
    except Exception as e:
        return [{'error': str(e)}]

if __name__ == '__main__':
    today = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    print("OVERVIEW|" + json.dumps(get_market_overview(), ensure_ascii=False))
    print("GAINERS|" + json.dumps(get_top_gainers(15), ensure_ascii=False))
    print("FUND_FLOW|" + json.dumps(get_fund_flow(), ensure_ascii=False))
    print("SECTORS|" + json.dumps(get_sector_hotspots(), ensure_ascii=False))
    print("LIMIT_UP|" + json.dumps(get_limit_up_stocks(), ensure_ascii=False))
    print(f"TIME|{today}")
`;

fs.writeFileSync(PY_SCRIPT, pythonScript, 'utf-8');

try {
    const result = execSync(`python "${PY_SCRIPT}"`, {
        encoding: 'utf-8',
        timeout: 180000,
        stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(result);
} catch (error) {
    console.error('执行出错:', error.message);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
} finally {
    try { fs.unlinkSync(PY_SCRIPT); } catch {}
}
