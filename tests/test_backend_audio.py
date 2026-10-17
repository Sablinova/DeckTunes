"""Run production audio methods with fake subprocesses; no Decky installation required."""
import ast
import asyncio
import json
import logging
import os
from pathlib import Path
import platform
import shutil
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch


def load_audio_code(decky):
    tree = ast.parse((Path(__file__).resolve().parents[1] / "main.py").read_text())
    methods = {
        "_create_yt_search", "_read_search_stderr", "_stop_search",
        "search_yt", "next_yt_result", "search_home_yt", "entry_to_info",
        "_unload", "update_ytdlp",
    }
    plugin = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "Plugin")
    plugin.body = [node for node in plugin.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in methods]
    selected = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in {"get_ytdlp_path", "preserve_ytdlp_binary"}]
    namespace = dict(asyncio=asyncio, json=json, os=os, platform=platform, shutil=shutil,
                     tempfile=tempfile, decky=decky, logger=logging.getLogger("audio-test"))
    exec(compile(ast.Module(body=selected + [plugin], type_ignores=[]), "main.py", "exec"), namespace)
    return namespace


class PersistentBinaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.decky = SimpleNamespace(DECKY_PLUGIN_DIR=str(self.root / "plugin"), DECKY_PLUGIN_RUNTIME_DIR=str(self.root / "runtime"))
        self.code = load_audio_code(self.decky)
        name = "yt-dlp.exe" if platform.system() == "Windows" else "yt-dlp"
        self.bundled = self.root / "plugin" / "bin" / name
        self.bundled.parent.mkdir(parents=True)
        self.bundled.write_bytes(b"updated-installed-binary")

    def test_bundled_binary_is_fallback_until_persisted(self):
        self.assertEqual(self.code["get_ytdlp_path"](), str(self.bundled))
        saved = Path(self.code["preserve_ytdlp_binary"]())
        self.assertEqual(saved.read_bytes(), b"updated-installed-binary")
        self.assertEqual(self.code["get_ytdlp_path"](), str(saved))

    def test_zip_reinstall_cannot_downgrade_persisted_update(self):
        saved = Path(self.code["preserve_ytdlp_binary"]())
        saved.write_bytes(b"future-in-app-update")
        self.bundled.write_bytes(b"old-zip-binary")
        self.code["preserve_ytdlp_binary"]()
        self.assertEqual(Path(self.code["get_ytdlp_path"]()).read_bytes(), b"future-in-app-update")

    def test_recreated_plugin_directory_keeps_runtime_update(self):
        saved = Path(self.code["preserve_ytdlp_binary"]())
        shutil.rmtree(self.root / "plugin")
        self.bundled.parent.mkdir(parents=True)
        self.bundled.write_bytes(b"reinstalled")
        self.assertEqual(self.code["get_ytdlp_path"](), str(saved))

    def test_existing_update_action_installs_into_persistent_directory(self):
        plugin = self.code["Plugin"]()
        plugin.ssl_context = None
        plugin.check_ytdlp_update = AsyncMock(return_value={
            "success": True, "update_available": True, "current_version": "old",
        })
        response = SimpleNamespace(status=200, content=SimpleNamespace(
            read=AsyncMock(side_effect=[b"future-in-app-update", b""])))

        class Context:
            def __init__(self, value):
                self.value = value
            async def __aenter__(self):
                return self.value
            async def __aexit__(self, *_args):
                pass

        self.code["aiohttp"] = SimpleNamespace(
            ClientTimeout=Mock(), ClientSession=Mock(return_value=Context(
                SimpleNamespace(get=Mock(return_value=Context(response))))))
        verified = SimpleNamespace(returncode=0, communicate=AsyncMock(
            return_value=(b"future-version\n", b"")))
        with patch.object(asyncio, "create_subprocess_exec", AsyncMock(return_value=verified)):
            result = asyncio.run(plugin.update_ytdlp())
        self.assertTrue(result["success"])
        saved = Path(self.code["get_ytdlp_path"]())
        self.assertEqual(saved.parent.parent, self.root / "runtime")
        self.assertEqual(saved.read_bytes(), b"future-in-app-update")
        self.assertEqual(self.bundled.read_bytes(), b"updated-installed-binary")


class SearchTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.code = load_audio_code(SimpleNamespace())
        self.plugin = self.code["Plugin"]()
        self.plugin.yt_process = None
        self.plugin.yt_stderr_task = None
        self.plugin.yt_search_id = 0
        self.plugin.yt_start_lock = asyncio.Lock()
        self.plugin.yt_process_lock = asyncio.Lock()
        self.plugin.home_search_lock = asyncio.Lock()
        self.plugin.home_yt_process = None
        self.plugin.http_server = None

    def process(self, line=b"", error=b"", returncode=0):
        proc = SimpleNamespace(returncode=returncode)
        proc.stdout = SimpleNamespace(readline=AsyncMock(return_value=line))
        proc.stderr = SimpleNamespace(read=AsyncMock(side_effect=[error, b""]))
        proc.wait = AsyncMock(return_value=returncode)
        proc.terminate = Mock(side_effect=lambda: setattr(proc, "returncode", -15))
        proc.kill = Mock(side_effect=lambda: setattr(proc, "returncode", -9))
        return proc

    async def test_search_error_reaches_frontend_instead_of_empty_results(self):
        proc = self.process(error=b"ERROR: JavaScript challenge failed", returncode=1)
        self.plugin._create_yt_search = AsyncMock(return_value=proc)
        token = await self.plugin.search_yt("Game Theme Music")
        with self.assertRaisesRegex(RuntimeError, "JavaScript challenge failed"):
            await self.plugin.next_yt_result(token)

    async def test_old_search_token_cannot_consume_new_search_results(self):
        proc = self.process()
        self.plugin._create_yt_search = AsyncMock(return_value=proc)
        await self.plugin.search_yt("Game")
        self.assertIsNone(await self.plugin.next_yt_result(0))
        proc.stdout.readline.assert_not_awaited()
        await self.plugin.yt_stderr_task

    async def test_home_search_is_independent_of_held_manual_cursor_lock(self):
        entry = {"id": "home", "url": "stream", "title": "Home", "thumbnail": ""}
        proc = self.process(line=json.dumps(entry).encode(), returncode=None)
        self.plugin._create_yt_search = AsyncMock(return_value=proc)
        original = object()
        self.plugin.yt_process = original
        await self.plugin.yt_process_lock.acquire()
        try:
            result = await asyncio.wait_for(self.plugin.search_home_yt("Home"), timeout=1)
        finally:
            self.plugin.yt_process_lock.release()
        self.assertEqual(result["id"], "home")
        self.assertIs(self.plugin.yt_process, original)
        proc.terminate.assert_called_once()

    async def test_home_search_reports_stderr_and_keeps_manual_state(self):
        proc = self.process(returncode=1)
        async def create(_term, stderr):
            stderr.write(b"ERROR: requested audio format is unavailable")
            return proc
        self.plugin._create_yt_search = create
        with self.assertRaisesRegex(RuntimeError, "audio format is unavailable"):
            await self.plugin.search_home_yt("Home")
        self.assertIsNone(self.plugin.yt_process)

    async def test_home_timeout_terminates_its_process(self):
        proc = self.process(returncode=None)
        proc.stdout.readline.side_effect = TimeoutError()
        self.plugin._create_yt_search = AsyncMock(return_value=proc)
        with self.assertRaisesRegex(RuntimeError, "timed out"):
            await self.plugin.search_home_yt("Home")
        proc.terminate.assert_called_once()
        self.assertIsNone(self.plugin.home_yt_process)

    async def test_unload_stops_both_searches_without_competing_stderr_readers(self):
        self.plugin.yt_process = self.process(returncode=None)
        self.plugin.home_yt_process = self.process(returncode=None)
        self.plugin.yt_stderr_task = asyncio.create_task(
            self.plugin._read_search_stderr(self.plugin.yt_process))
        await self.plugin._unload()
        self.plugin.yt_process.terminate.assert_called_once()
        self.plugin.home_yt_process.terminate.assert_called_once()
        self.assertTrue(self.plugin.yt_stderr_task.done())


if __name__ == "__main__":
    unittest.main()
