# -*- coding: utf-8 -*-
"""测试东方财富实时K线接口"""
import requests

symbol = "510300"

# 东方财富 push2.eastmoney.com 接口（实时+近期K线）
url = f"https://push2.eastmoney.com/api/qt/stock/kline/get"
params = {
    "secid": f"1.{symbol}",
    "fields1": "f1,f2,f3,f4,f5,f6",
    "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
    "klt": "101",
    "fqt": "1",
    "beg": "0",  # 0 表示从最早开始
    "end": "20500101",
    "lmt": "60",
    "ut": "fa5fd1943c7b3eed6dd8a16a46f82e02",
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://quote.eastmoney.com/",
    "Accept": "*/*",
}

resp = requests.get(url, params=params, headers=headers, timeout=10)
print(f"Status: {resp.status_code}")
data = resp.json()

if data and "data" in data:
    klines = data["data"].get("klines", [])
    print(f"Got {len(klines)} kline records")
    for k in klines[-5:]:
        print(f"  {k}")
else:
    print(f"No data. Response: {resp.text[:500]}")
