import asyncio
import base64
import datetime
import json
import os
import random
import ssl
import subprocess
import aiohttp
from aiohttp import web
import certifi
import logging
import platform
import shutil

import decky
from settings import SettingsManager  # type: ignore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_ytdlp_path() -> str:
    binary = "yt-dlp.exe" if platform.system() == "Windows" else "yt-dlp"
    return os.path.join(decky.DECKY_PLUGIN_DIR, "bin", binary)


class Plugin:
    yt_process: asyncio.subprocess.Process | None = None
    yt_process_lock = asyncio.Lock()
    music_path = f"{decky.DECKY_PLUGIN_RUNTIME_DIR}/music"
    cache_path = f"{decky.DECKY_PLUGIN_RUNTIME_DIR}/cache"
    ssl_context = ssl.create_default_context(cafile=certifi.where())

    # HTTP server for audio playback
    audio_port: int | None = None
    app: web.Application | None = None
    runner: web.AppRunner | None = None
    site: web.TCPSite | None = None

    async def _migrate_old_settings(self):
        """Migrate settings and music files from SDH-GameThemeMusic if they exist."""
        old_plugin_names = ["SDH-GameThemeMusic", "sdh-gamethememusic"]
        migration_marker_file = os.path.join(
            decky.DECKY_PLUGIN_SETTINGS_DIR, ".migrated_from_sdh"
        )

        # Skip if we've already migrated
        if os.path.exists(migration_marker_file):
            logger.info("Settings already migrated from SDH-GameThemeMusic")
            return

        for old_name in old_plugin_names:
            old_plugin_dir = os.path.join(
                os.path.dirname(decky.DECKY_PLUGIN_DIR), old_name
            )
            old_settings_dir = os.path.join(
                os.path.dirname(decky.DECKY_PLUGIN_SETTINGS_DIR), old_name
            )
            old_config_file = os.path.join(old_settings_dir, "config.json")

            if os.path.exists(old_config_file):
                try:
                    logger.info(
                        f"Found old settings at {old_config_file}, migrating..."
                    )
                    with open(old_config_file, "r") as f:
                        old_settings = json.load(f)

                    # Copy settings to new plugin
                    for key, value in old_settings.items():
                        self.settings.setSetting(key, value)

                    logger.info(f"Successfully migrated settings from {old_name}")

                    # Migrate music files if they exist
                    old_music_dir = os.path.join(
                        os.path.dirname(decky.DECKY_PLUGIN_RUNTIME_DIR),
                        old_name,
                        "music",
                    )
                    if os.path.exists(old_music_dir):
                        os.makedirs(self.music_path, exist_ok=True)
                        music_files = os.listdir(old_music_dir)
                        if music_files:
                            logger.info(f"Migrating {len(music_files)} music files...")
                            for filename in music_files:
                                old_path = os.path.join(old_music_dir, filename)
                                new_path = os.path.join(self.music_path, filename)
                                if os.path.isfile(old_path) and not os.path.exists(
                                    new_path
                                ):
                                    shutil.copy2(old_path, new_path)
                            logger.info("Music files migrated successfully")

                    # Mark as migrated
                    with open(migration_marker_file, "w") as f:
                        f.write(
                            f"Migrated from {old_name} on {datetime.datetime.now().isoformat()}\n"
                        )

                    logger.info(f"Migration from {old_name} complete")
                    return
                except Exception as e:
                    logger.error(f"Failed to migrate from {old_name}: {e}")

        logger.info("No old SDH-GameThemeMusic settings found to migrate")

    async def _main(self):
        logger.info("Initializing DeckTunes...")
        self.settings = SettingsManager(
            name="config", settings_directory=decky.DECKY_PLUGIN_SETTINGS_DIR
        )
        logger.info("Settings loaded.")

        # Migrate old SDH-GameThemeMusic settings if they exist
        await self._migrate_old_settings()

        # Initialize HTTP server for serving audio files
        self.audio_port = random.randint(30000, 40000)
        self.app = web.Application()
        self.app.router.add_get("/audio/{filename}", self.serve_audio_file)
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, "localhost", self.audio_port)
        await self.site.start()
        logger.info(f"DeckTunes audio server started on port {self.audio_port}")

    async def _unload(self):
        logger.info("Unloading DeckTunes...")

        # Stop HTTP server
        if self.site:
            await self.site.stop()
            logger.info("Audio server site stopped")
        if self.runner:
            await self.runner.cleanup()
            logger.info("Audio server runner cleaned up")

        # Terminate yt-dlp process if running
        if self.yt_process is not None and self.yt_process.returncode is None:
            logger.info("Terminating yt_process...")
            self.yt_process.terminate()
            async with self.yt_process_lock:
                try:
                    await asyncio.wait_for(self.yt_process.communicate(), timeout=5)
                except TimeoutError:
                    logger.warning("yt_process timeout. Killing process.")
                    self.yt_process.kill()

        logger.info("DeckTunes unloaded successfully")

    async def serve_audio_file(self, request):
        """Serve audio files from the music directory via HTTP"""
        try:
            filename = request.match_info["filename"]

            # Sanitize filename to prevent directory traversal
            if ".." in filename or "/" in filename or "\\" in filename:
                logger.error(f"Invalid filename requested: {filename}")
                return web.Response(status=400, text="Invalid filename")

            filepath = os.path.join(self.music_path, filename)

            if not os.path.exists(filepath):
                logger.error(f"Audio file not found: {filepath}")
                return web.Response(status=404, text="File not found")

            logger.info(f"Serving audio file: {filename}")
            return web.FileResponse(filepath)

        except Exception as e:
            logger.error(f"Error serving audio file: {e}")
            return web.Response(status=500, text="Internal server error")

    async def get_audio_port(self):
        """Return the HTTP server port to frontend"""
        logger.info(f"Frontend requested audio port: {self.audio_port}")
        return self.audio_port

    async def set_setting(self, key, value):
        logger.info(f"Setting config key: {key} = {value}")
        self.settings.setSetting(key, value)

    async def get_setting(self, key, default):
        value = self.settings.getSetting(key, default)
        logger.info(f"Retrieved config key: {key} = {value}")
        return value

    async def search_yt(self, term: str):
        logger.info(f"Searching YouTube for: {term}")
        ytdlp_path = get_ytdlp_path()
        if os.path.exists(ytdlp_path):
            os.chmod(ytdlp_path, 0o755)

        if self.yt_process is not None and self.yt_process.returncode is None:
            logger.info("Terminating previous yt_process...")
            self.yt_process.terminate()
            async with self.yt_process_lock:
                await self.yt_process.communicate()

        self.yt_process = await asyncio.create_subprocess_exec(
            ytdlp_path,
            f"ytsearch10:{term}",
            "-j",
            "-f",
            "bestaudio",
            "--match-filters",
            f"duration<?{20 * 60}",
            stdout=asyncio.subprocess.PIPE,
            limit=10 * 1024**2,
            env={**os.environ, "LD_LIBRARY_PATH": "/usr/lib:/lib"},
        )
        logger.info("yt-dlp search process started.")

    async def next_yt_result(self):
        async with self.yt_process_lock:
            if (
                not self.yt_process
                or not (output := self.yt_process.stdout)
                or not (line := (await output.readline()).strip())
            ):
                logger.info("No more results from yt_process.")
                return None
            logger.debug(f"Received result line: {line[:100]}...")
            entry = json.loads(line)
            return self.entry_to_info(entry)

    @staticmethod
    def entry_to_info(entry):
        return {
            "url": entry["url"],
            "title": entry["title"],
            "id": entry["id"],
            "thumbnail": entry["thumbnail"],
        }

    def local_match(self, id: str) -> str | None:
        logger.info(f"Looking for local match for ID: {id}")
        try:
            for file in os.listdir(self.music_path):
                if os.path.isfile(
                    os.path.join(self.music_path, file)
                ) and file.startswith(id + "."):
                    logger.info(f"Local match found: {file}")
                    return os.path.join(self.music_path, file)
        except FileNotFoundError:
            logger.warning(f"Music path not found: {self.music_path}")
        logger.info("No local match found.")
        return None

    async def single_yt_url(self, id: str):
        local_match = self.local_match(id)
        if local_match:
            filename = os.path.basename(local_match)
            audio_url = f"http://localhost:{self.audio_port}/audio/{filename}"
            logger.info(f"Serving local audio via HTTP: {audio_url}")
            return {
                "success": True,
                "url": audio_url,
                "filename": filename,
                "local": True,
            }

        logger.info(f"No local file. Fetching yt-dlp info for: {id}")
        ytdlp_path = get_ytdlp_path()
        result = await asyncio.create_subprocess_exec(
            ytdlp_path,
            f"{id}",
            "-j",
            "-f",
            "bestaudio",
            stdout=asyncio.subprocess.PIPE,
            env={**os.environ, "LD_LIBRARY_PATH": "/usr/lib:/lib"},
        )
        if result.stdout is None or not (
            output := (await result.stdout.read()).strip()
        ):
            logger.warning("yt-dlp returned no output.")
            return {"success": False, "error": "No output from yt-dlp"}
        entry = json.loads(output)
        logger.info(f"Returning streaming URL for: {id}")
        return {"success": True, "url": entry["url"], "local": False}

    async def download_yt_audio(self, id: str):
        if self.local_match(id):
            logger.info(f"Audio already downloaded for ID: {id}")
            return

        logger.info(f"Downloading audio for ID: {id}")
        ytdlp_path = get_ytdlp_path()
        process = await asyncio.create_subprocess_exec(
            ytdlp_path,
            f"{id}",
            "-f",
            "bestaudio",
            "-o",
            "%(id)s.%(ext)s",
            "-P",
            self.music_path,
            env={**os.environ, "LD_LIBRARY_PATH": "/usr/lib:/lib"},
        )
        await process.communicate()

        original_path = os.path.join(self.music_path, f"{id}.m4a")
        renamed_path = os.path.join(self.music_path, f"{id}.webm")
        if os.path.exists(original_path):
            logger.info(f"Renaming {original_path} to {renamed_path}")
            os.rename(original_path, renamed_path)

    async def download_url(self, url: str, id: str):
        logger.info(f"Downloading file from URL: {url}")
        async with aiohttp.ClientSession() as session:
            res = await session.get(url, ssl=self.ssl_context)
            res.raise_for_status()
            file_path = os.path.join(self.music_path, f"{id}.webm")
            with open(file_path, "wb") as file:
                async for chunk in res.content.iter_chunked(1024):
                    file.write(chunk)
            logger.info(f"Download complete: {file_path}")

    async def clear_downloads(self):
        logger.info("Clearing all downloaded music files...")
        try:
            for file in os.listdir(self.music_path):
                full_path = os.path.join(self.music_path, file)
                if os.path.isfile(full_path):
                    logger.info(f"Removing file: {full_path}")
                    os.remove(full_path)
        except FileNotFoundError:
            logger.warning(f"Music path not found: {self.music_path}")

    async def export_cache(self, cache: dict):
        os.makedirs(self.cache_path, exist_ok=True)
        filename = f"backup-{datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}.json"
        full_path = os.path.join(self.cache_path, filename)
        with open(full_path, "w") as file:
            json.dump(cache, file)
        logger.info(f"Cache exported to {full_path}")

    async def list_cache_backups(self):
        logger.info("Listing cache backup files...")
        try:
            return [
                file.rsplit(".", 1)[0]
                for file in os.listdir(self.cache_path)
                if os.path.isfile(os.path.join(self.cache_path, file))
            ]
        except FileNotFoundError:
            logger.warning(f"Cache path not found: {self.cache_path}")
            return []

    async def import_cache(self, name: str):
        path = os.path.join(self.cache_path, f"{name}.json")
        logger.info(f"Importing cache from {path}")
        with open(path, "r") as file:
            return json.load(file)

    async def clear_cache(self):
        logger.info("Clearing all cache files...")
        try:
            for file in os.listdir(self.cache_path):
                full_path = os.path.join(self.cache_path, file)
                if os.path.isfile(full_path):
                    logger.info(f"Removing file: {full_path}")
                    os.remove(full_path)
        except FileNotFoundError:
            logger.warning(f"Cache path not found: {self.cache_path}")

    async def get_ytdlp_version(self):
        """Get the currently installed yt-dlp version."""
        try:
            ytdlp_path = get_ytdlp_path()
            if not os.path.exists(ytdlp_path):
                logger.warning("yt-dlp binary not found")
                return {"success": False, "error": "yt-dlp not found"}

            result = await asyncio.create_subprocess_exec(
                ytdlp_path,
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "LD_LIBRARY_PATH": "/usr/lib:/lib"},
            )
            stdout, stderr = await result.communicate()

            if result.returncode == 0:
                version = stdout.decode().strip()
                logger.info(f"Current yt-dlp version: {version}")
                return {"success": True, "version": version}
            else:
                error_msg = stderr.decode().strip()
                logger.error(f"Failed to get yt-dlp version: {error_msg}")
                return {"success": False, "error": error_msg}
        except Exception as e:
            logger.error(f"Exception getting yt-dlp version: {e}")
            return {"success": False, "error": str(e)}

    async def get_ytdlp_latest_release(self):
        """Fetch the latest yt-dlp release version from GitHub."""
        try:
            logger.info("Fetching latest yt-dlp release from GitHub...")
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
                    ssl=self.ssl_context,
                    headers={"Accept": "application/vnd.github+json"},
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        version = data.get("tag_name", "").lstrip("v")
                        logger.info(f"Latest yt-dlp release: {version}")
                        return {
                            "success": True,
                            "version": version,
                            "url": data.get("html_url"),
                        }
                    else:
                        error = f"GitHub API returned status {response.status}"
                        logger.error(error)
                        return {"success": False, "error": error}
        except Exception as e:
            logger.error(f"Exception fetching latest yt-dlp release: {e}")
            return {"success": False, "error": str(e)}

    async def check_ytdlp_update(self):
        """Check if a yt-dlp update is available."""
        logger.info("Checking for yt-dlp updates...")
        current = await self.get_ytdlp_version()
        if not current["success"]:
            return current

        latest = await self.get_ytdlp_latest_release()
        if not latest["success"]:
            return latest

        current_version = current["version"]
        latest_version = latest["version"]
        update_available = current_version != latest_version

        logger.info(
            f"Update check: current={current_version}, latest={latest_version}, available={update_available}"
        )
        return {
            "success": True,
            "current_version": current_version,
            "latest_version": latest_version,
            "update_available": update_available,
        }

    async def update_ytdlp(self):
        """Download and install the latest yt-dlp version."""
        logger.info("Starting yt-dlp update...")

        # Check if update is needed
        check = await self.check_ytdlp_update()
        if not check["success"]:
            return check

        if not check["update_available"]:
            logger.info("yt-dlp is already up to date")
            return {
                "success": True,
                "message": "Already up to date",
                "version": check["current_version"],
            }

        ytdlp_path = get_ytdlp_path()
        backup_path = ytdlp_path + ".backup"
        temp_path = ytdlp_path + ".tmp"

        try:
            # Backup current binary
            if os.path.exists(ytdlp_path):
                logger.info(f"Backing up current yt-dlp to {backup_path}")
                shutil.copy2(ytdlp_path, backup_path)

            # Download latest version
            download_url = (
                "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
            )
            logger.info(f"Downloading latest yt-dlp from {download_url}")

            async with aiohttp.ClientSession() as session:
                async with session.get(download_url, ssl=self.ssl_context) as response:
                    if response.status != 200:
                        raise Exception(
                            f"Download failed with status {response.status}"
                        )

                    # Write to temporary file first
                    temp_path = ytdlp_path + ".tmp"
                    with open(temp_path, "wb") as f:
                        while True:
                            chunk = await response.content.read(8192)
                            if not chunk:
                                break
                            f.write(chunk)

            # Make executable
            os.chmod(temp_path, 0o755)

            # Verify the download works
            logger.info("Verifying downloaded binary...")
            result = await asyncio.create_subprocess_exec(
                temp_path,
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "LD_LIBRARY_PATH": "/usr/lib:/lib"},
            )
            stdout, stderr = await result.communicate()

            if result.returncode != 0:
                raise Exception(
                    f"Downloaded binary verification failed: {stderr.decode()}"
                )

            new_version = stdout.decode().strip()
            logger.info(f"Downloaded binary verified, version: {new_version}")

            # Replace old binary with new one
            os.replace(temp_path, ytdlp_path)

            # Remove backup
            if os.path.exists(backup_path):
                os.remove(backup_path)

            logger.info(f"yt-dlp successfully updated to {new_version}")
            return {
                "success": True,
                "message": "Update successful",
                "old_version": check["current_version"],
                "new_version": new_version,
            }

        except Exception as e:
            logger.error(f"yt-dlp update failed: {e}")

            # Restore backup if it exists
            if os.path.exists(backup_path):
                logger.info("Restoring backup...")
                shutil.copy2(backup_path, ytdlp_path)
                os.chmod(ytdlp_path, 0o755)

            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

            return {"success": False, "error": str(e)}
