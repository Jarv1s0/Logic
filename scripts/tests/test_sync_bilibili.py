import importlib.util
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("sync_bilibili", Path(__file__).parents[1] / "sync_bilibili.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class SyncTests(unittest.TestCase):
    def test_beijing_timestamp_and_date_merge(self):
        content = b"#!name=test\n#!date=2026-11-01\n[Script]\n[MitM]\n"
        now = datetime(2026, 11, 2, 3, 44, 13, tzinfo=timezone.utc)
        stamped = sync.stamp_date(content, now)
        self.assertIn(b"#!date=2026-11-02 11:44:13\n", stamped)
        self.assertEqual(stamped.count(b"#!date="), 1)
        local = stamped.replace(b"name=test", b"name=custom")
        incoming = content.replace(b"2026-11-01", b"2026-11-02")
        merged = sync.merge(local, content, incoming, sync.PLUGIN)
        self.assertIn(b"name=custom", merged)
        self.assertNotIn(b"#!date", merged)
        self.assertIn(b"#!date=2026-11-02 11:44:13\n", sync.stamp_date(merged, now))

    def test_merge_preserves_independent_edits(self):
        base = b"first\nmiddle\nlast\n"
        local = b"custom\nmiddle\nlast\n"
        incoming = b"first\nmiddle\nupdated\n"
        self.assertEqual(sync.merge(local, base, incoming, "plugin"), b"custom\nmiddle\nupdated\n")

    def test_conflict_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "三方合并失败"):
            sync.merge(b"local\n", b"base\n", b"upstream\n", "plugin")

    def test_new_dependency_is_rejected(self):
        plugin = f"#!name=test\n[Script]\n{sync.RAW}refs/heads/master/dist/new.js\n[MitM]\n"
        with self.assertRaisesRegex(RuntimeError, "未收录"):
            sync.prepare("release/loon/plugin/bilibili.lpx", plugin.encode())

    def test_all_dependency_links_are_rewritten(self):
        links = "\n".join(sync.RAW + "refs/heads/master/" + source for source in sync.FILES)
        plugin = f"#!name=test\n[Script]\n{links}\n[MitM]\n"
        result = sync.prepare("release/loon/plugin/bilibili.lpx", plugin.encode()).decode()
        self.assertNotIn(sync.RAW, result)
        for destination in sync.FILES.values():
            self.assertIn(sync.LOCAL_RAW + destination, result)

    def test_sync_baseline_local_changes_and_failure_atomicity(self):
        old_revision, new_revision = "a" * 40, "b" * 40
        plugin = b"#!name=test\n[Script]\n[MitM]\n"
        old = {source: plugin if source.endswith(".lpx") else b"first\nmiddle\nlast\n"
               for source in sync.FILES}
        new = dict(old)
        first, second = list(sync.FILES)[1:3]
        new[first] = b"first\nmiddle\nupdated\n"
        new[second] = b"upstream\nmiddle\nlast\n"

        def download(url):
            revision, source = url.removeprefix(sync.RAW).split("/", 1)
            return (old if revision == old_revision else new)[source]

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            sync.sync(root, old_revision, download)
            target = root / sync.FILES[first]
            conflict = root / sync.FILES[second]
            target.write_bytes(b"custom\nmiddle\nlast\n")
            conflict.write_bytes(b"local\nmiddle\nlast\n")
            before = {p: p.read_bytes() for p in root.rglob("*") if p.is_file()}
            with self.assertRaisesRegex(RuntimeError, "三方合并失败"):
                sync.sync(root, new_revision, download)
            self.assertEqual(before, {p: p.read_bytes() for p in root.rglob("*") if p.is_file()})
            conflict.write_bytes(old[second])
            sync.sync(root, new_revision, download)
            self.assertEqual(target.read_bytes(), b"custom\nmiddle\nupdated\n")
            state = json.loads((root / sync.STATE).read_text())
            self.assertEqual(state["revision"], new_revision)
            self.assertEqual(state["sha256"][sync.FILES[first]], sync.digest(new[first]))
            self.assertEqual(sync.sync(root, new_revision, download), [])
            self.assertEqual(target.read_bytes(), b"custom\nmiddle\nupdated\n")
            self.assertEqual(sync.sync(root, "c" * 40, download), [])
            self.assertEqual(json.loads((root / sync.STATE).read_text())["revision"], new_revision)

    def test_missing_local_file_stops_sync(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)

            def download(url):
                return b"#!name=test\n[Script]\n[MitM]\n" if url.endswith(".lpx") else b"content\n"

            sync.sync(root, "a" * 40, download)
            (root / "Loon/bilibili.lpx").unlink()
            with self.assertRaisesRegex(RuntimeError, "本地文件缺失"):
                sync.sync(root, "b" * 40, download)

    def test_manual_resolution_and_download_failure(self):
        old_revision, new_revision = "a" * 40, "b" * 40

        def download(url):
            if url.endswith(".lpx"):
                return b"#!name=test\n[Script]\n[MitM]\n"
            return b"old\n" if old_revision in url else b"new\n"

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            sync.sync(root, old_revision, download)
            path = sync.FILES["dist/bilibili.json.js"]
            (root / path).write_bytes(b"manually merged new and custom\n")
            before = {p: p.read_bytes() for p in root.rglob("*") if p.is_file()}

            def broken_download(url):
                if url.endswith("LICENSE"):
                    raise OSError("network unavailable")
                return download(url)

            with self.assertRaises(OSError):
                sync.sync(root, new_revision, broken_download, resolved=[path])
            self.assertEqual(before, {p: p.read_bytes() for p in root.rglob("*") if p.is_file()})
            sync.sync(root, new_revision, download, resolved=[path])
            self.assertEqual((root / path).read_bytes(), b"manually merged new and custom\n")
            self.assertEqual(sync.sync(root, new_revision, download), [])
            with self.assertRaisesRegex(RuntimeError, "必须属于"):
                sync.sync(root, new_revision, download, resolved=["README.md"])


if __name__ == "__main__":
    unittest.main()
