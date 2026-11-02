"""回放本地 HAR；只输出统计，不输出账号、URL 参数或响应正文。"""
import base64
import copy
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit


def main():
    har_path, jq_path = sys.argv[1:]
    plugin = Path(__file__).resolve().parents[1] / 'Loon/Haoqing_remove_ads.lpx'
    text = plugin.read_text(encoding='utf-8')
    hosts = set(re.search(r'^hostname = (.+)$', text, re.M)[1].split(', '))
    blocked = set(re.findall(r'^DOMAIN, ([^,]+), REJECT$', text, re.M))
    rules = []
    for line in text.splitlines():
        if not line.startswith('response if '):
            continue
        match = re.fullmatch(
            r'response if \$\{request.method\} == "(GET|POST)" && '
            r'\$\{url\} ~= /(.+)/'
            r'( && \$\{response.status\} == 200)? then (.+)', line)
        assert match, '无法识别的规则结构'
        method, pattern, status_guard, action = match.groups()
        regex = re.compile(pattern.replace(r'\/', '/'))
        if action.startswith('response.body.mock('):
            payload = re.fullmatch(r'response.body.mock\("json", `(.*)`, 200\)', action)
            assert payload and not status_guard
            value = json.loads(payload[1])
            assert value['result']['code'] == 0
            rules.append((method, regex, 'mock', value))
        else:
            payload = re.fullmatch(r'response.json.jq\((".*")\)', action)
            assert payload and status_guard
            rules.append((method, regex, 'jq', json.loads(payload[1])))
    assert len(rules) == 10

    def run_jq(program, obj):
        proc = subprocess.run([jq_path, '-c', program], input=json.dumps(obj),
                              text=True, encoding='utf-8', capture_output=True, check=True)
        return json.loads(proc.stdout)

    hits = [0] * len(rules)
    entries = json.loads(Path(har_path).read_text(encoding='utf-8-sig'))['log']['entries']
    untouched = rejected = 0
    for entry in entries:
        request, response = entry['request'], entry['response']
        url = request['url']
        matched = [(i, rule) for i, rule in enumerate(rules)
                   if request['method'] == rule[0] and rule[1].search(url)]
        assert len(matched) <= 1, '规则发生重叠'
        if not matched:
            if urlsplit(url).hostname in blocked:
                rejected += 1
            else:
                untouched += 1
            continue
        i, (method, regex, kind, payload) = matched[0]
        hits[i] += 1
        assert urlsplit(url).hostname in hosts, 'MitM 未覆盖'
        path = urlsplit(url).path
        content = response['content']
        raw = content.get('text', '')
        if content.get('encoding') == 'base64':
            raw = base64.b64decode(raw).decode('utf-8')
        before = json.loads(raw)
        after = copy.deepcopy(payload) if kind == 'mock' else run_jq(payload, before)
        assert after['result']['code'] == 0
        if kind == 'jq':
            assert response['status'] == 200
            assert after['result'] == before['result']
            for error in ({'result': {'code': 1331}, 'data': None},
                          {'result': {'code': 1331}, 'data': []},
                          {'result': {'code': 0}, 'data': None},
                          {'result': {'code': 0}, 'data': {'unknown': True}}):
                assert run_jq(payload, error) == error, '错误或未知结构被改写'
            assert run_jq(payload, after) == after, '重复执行不稳定'
        data = after['data']
        if path.endswith('/launcher.json'):
            assert data['launchers'] == [] and data['thirdPartyAd']['switchOn'] == 0
        elif path.endswith('/getAdSetting.json'):
            assert data == {'remainingTimes': 0, 'switchOn': 0}
        elif path.endswith('/feed.json'):
            assert data['feeds'] == []
        elif path.endswith('/banner.json'):
            assert data['banners'] == []
        elif path.endswith('/listByPosition.json'):
            assert data == {'total': 0, 'rows': []}
        elif path.endswith('/listByPositions.json'):
            expected = copy.deepcopy(before)
            for position in expected['data']['positions']:
                position['ads'] = []
            assert after == expected
        elif path.endswith('/v3/get.json'):
            expected = copy.deepcopy(before)
            expected['data']['moduleList'] = [m for m in before['data']['moduleList']
                                            if m.get('moduleType') != 210]
            assert after == expected
            assert len(data['moduleList']) == len(before['data']['moduleList']) - 1
        elif path.endswith('/getFirstPageTips.json'):
            expected = copy.deepcopy(before)
            expected['data'] = [tip for tip in before['data']
                                if not tip.get('schema', '').startswith('haoqing://youzan?')]
            assert after == expected and len(data) == 3
        elif path.endswith('/statistic.d'):
            assert data is None
        else:
            assert data == []

        # 完整路径与主机边界；方法条件也必须阻止其他方法。
        parsed = urlsplit(url)
        root = f'https://{parsed.netloc}{parsed.path}'
        assert regex.search(root) and regex.search(root + '?test=1')
        for invalid in (root + '/extra', root + '.bak',
                        root.replace(parsed.netloc, parsed.netloc + '.invalid'),
                        root.replace('https://', 'http://')):
            assert not regex.search(invalid), '正则边界过宽'
        assert not ('DELETE' == method and regex.search(root))
    assert all(hits), '存在未被 HAR 覆盖的规则'
    assert sum(hits) + untouched + rejected == len(entries)
    print(f'通过：{len(entries)} 条请求，{len(rules)} 条 Rewrite 全覆盖；'
          f'{sum(hits)} 条改写，{rejected} 条广告域名拒绝，{untouched} 条不匹配。')
    print('通过：Mock JSON、真实 JQ 执行、正常字段保留、错误/未知结构、幂等性与匹配边界。')


if __name__ == '__main__':
    main()
