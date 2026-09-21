import urllib.request
import re

def get_agro():
    soja = "136,50"
    milho = "62,80"
    try:
        req = urllib.request.Request(
            'https://www.noticiasagricolas.com.br/cotacoes/soja/soja-indicador-cepea-esalq-porto-paranagua',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        html = urllib.request.urlopen(req, timeout=4).read().decode('utf-8')
        m = re.search(r'class="cot-fisicas".*?<tbody>.*?<tr>.*?<td>.*?</td>\s*<td>\s*([0-9.,]+)\s*</td>', html, re.DOTALL)
        if m:
            soja = m.group(1).strip()
    except Exception as e:
        print("Soja fetch err:", e)

    try:
        req = urllib.request.Request(
            'https://www.noticiasagricolas.com.br/cotacoes/milho/milho-indicador-cepea-esalq-b3-campinas-sp',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        html = urllib.request.urlopen(req, timeout=4).read().decode('utf-8')
        m = re.search(r'class="cot-fisicas".*?<tbody>.*?<tr>.*?<td>.*?</td>\s*<td>\s*([0-9.,]+)\s*</td>', html, re.DOTALL)
        if m:
            milho = m.group(1).strip()
    except Exception as e:
        print("Milho fetch err:", e)

    print(f"SOJA: {soja} | MILHO: {milho}")

get_agro()
