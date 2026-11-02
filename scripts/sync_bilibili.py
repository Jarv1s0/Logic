"""同步 Sparkle B 站插件，以旧上游为基线三方合并本地修改。"""

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
STATE = Path(".github/upstream/bilibili.json")
UPSTREAM = "kokoryh/Sparkle"
RAW = f"https://raw.githubusercontent.com/{UPSTREAM}/"
LOCAL_RAW = "https://raw.githubusercontent.com/Jarv1s0/Logic/master/"
PLUGIN = "Loon/bilibili.lpx"
BEIJING = timezone(timedelta(hours=8))
DATE_LINE = rb"(?m)^#!date[ \t]*=[^\n]*\n?"
FILES = {
    "release/loon/plugin/bilibili.lpx": "Loon/bilibili.lpx",
    **{
        f"dist/{name}.js": f"Loon/Script/Bilibili/{name}.js"
        for name in (
            "bilibili.json", "bilibili.protobuf.request",
            "bilibili.protobuf.response", "webpage.bilibili",
        )
    },
    **{
        f"jq/bilibili.{name}.jq": f"Loon/Script/Bilibili/bilibili.{name}.jq"
        for name in ("mine", "tab")
    },
    "LICENSE": "Loon/Script/Bilibili/LICENSE",
}


def fetch(url, api=False):
    headers = {"User-Agent": "Logic-bilibili-sync"}
    if api and os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    with urlopen(Request(url, headers=headers), timeout=60) as response:
        return response.read()


def digest(content):
    return hashlib.sha256(content).hexdigest()


def normalize(content):
    return content.decode("utf-8").replace("\r\n", "\n").encode("utf-8")


def stamp_date(content, now=None):
    timestamp = (now or datetime.now(timezone.utc)).astimezone(BEIJING).strftime("%Y-%m-%d %H:%M:%S")
    line = f"#!date={timestamp}\n".encode("utf-8")
    if re.search(DATE_LINE, content):
        return re.sub(DATE_LINE, lambda match: line, content)
    first, separator, rest = content.partition(b"\n")
    return first + b"\n" + line + rest


def prepare(source, content):
    content = normalize(content)
    if source != "release/loon/plugin/bilibili.lpx":
        return content
    text = content.decode("utf-8")
    if not text.startswith("#!name=") or "[Script]" not in text or "[MitM]" not in text:
        raise RuntimeError("上游插件格式异常，停止同步")
    for upstream_path, local_path in FILES.items():
        text = text.replace(RAW + "refs/heads/master/" + upstream_path, LOCAL_RAW + local_path)
        text = text.replace(RAW + "master/" + upstream_path, LOCAL_RAW + local_path)
    # 新增依赖必须人工确认并加入 FILES，不能悄悄混用另一版本的上游资源。
    if RAW in text:
        raise RuntimeError("插件出现未收录的 Sparkle 依赖，请更新 FILES 后重试")
    return text.encode("utf-8")


def merge(local, base, incoming, path):
    if path == PLUGIN:
        # 日期属于本地发布元数据，不参与上游和本地功能改动的合并。
        local, base, incoming = (re.sub(DATE_LINE, b"", content) for content in (local, base, incoming))
    if local == base or local == incoming:
        return incoming
    if base == incoming:
        return local
    with tempfile.TemporaryDirectory(prefix="bilibili-merge-") as folder:
        paths = [Path(folder) / name for name in ("local", "base", "upstream")]
        for target, content in zip(paths, (local, base, incoming)):
            target.write_bytes(content)
        result = subprocess.run(
            ["git", "merge-file", "--stdout", "--diff3", "-L", str(path),
             "-L", "旧上游", "-L", "新上游", *map(str, paths)],
            capture_output=True,
        )
    if result.returncode != 0:
        raise RuntimeError(f"三方合并失败：{path}；未写入任何同步文件，请手动处理后重试")
    return result.stdout


def sync(root, revision, download=fetch, resolved=()):
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise RuntimeError("上游提交号必须为完整的 40 位 SHA")
    if set(resolved) - set(FILES.values()):
        raise RuntimeError("手动解决的路径必须属于 B 站同步清单")
    state_path = root / STATE
    previous = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else None
    if previous and (previous.get("upstream") != UPSTREAM or previous.get("files") != FILES):
        raise RuntimeError("同步清单与基线不一致，需要人工迁移")
    if previous and not re.fullmatch(r"[0-9a-f]{40}", previous.get("revision", "")):
        raise RuntimeError("基线提交号无效")

    planned = {}
    hashes = {}
    for source, destination in FILES.items():
        incoming = prepare(source, download(RAW + revision + "/" + source))
        hashes[destination] = digest(incoming)
        target = root / destination
        if previous:
            if not target.is_file():
                raise RuntimeError(f"本地文件缺失：{destination}；停止同步，避免恢复被有意删除的文件")
            local = normalize(target.read_bytes())
            old_hash = previous["sha256"][destination]
            if destination in resolved:
                merged = local
            elif digest(local) == old_hash or local == incoming:
                merged = incoming
            elif hashes[destination] == old_hash:
                merged = local
            else:
                base = prepare(source, download(RAW + previous["revision"] + "/" + source))
                if digest(base) != old_hash:
                    raise RuntimeError(f"旧上游内容与基线校验值不符：{destination}")
                merged = merge(local, base, incoming, destination)
        else:
            if target.exists():
                raise RuntimeError(f"首次同步不能覆盖现有文件：{destination}")
            merged = incoming
        planned[target] = merged

    # 上游其他项目的提交不产生本仓库的空更新。
    if previous and previous["sha256"] == hashes:
        return []
    planned[root / PLUGIN] = stamp_date(planned[root / PLUGIN])
    state = {"upstream": UPSTREAM, "revision": revision, "files": FILES, "sha256": hashes}
    planned[state_path] = (json.dumps(state, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    # 所有下载、校验和合并先完成；冲突或网络错误不会留下半套更新。
    changed = []
    for target, content in planned.items():
        if not target.exists() or target.read_bytes() != content:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            changed.append(target.relative_to(root).as_posix())
    return changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", help="指定 Sparkle 的完整提交号；默认读取 master")
    parser.add_argument("--resolved", action="append", default=[], metavar="PATH",
                        help="已手动合并到指定上游版本的文件，可重复；必须同时指定 --revision")
    args = parser.parse_args()
    if args.resolved and not args.revision:
        parser.error("--resolved 必须同时指定 --revision，避免确认错误的上游版本")
    try:
        revision = args.revision or json.loads(
            fetch(f"https://api.github.com/repos/{UPSTREAM}/commits/master", api=True)
        )["sha"]
        changed = sync(ROOT, revision, resolved=args.resolved)
    except Exception as error:
        parser.exit(1, f"同步失败：{error}\n")
    print("已同步：\n" + "\n".join(changed) if changed else "上游 B 站文件没有变化")


if __name__ == "__main__":
    main()
