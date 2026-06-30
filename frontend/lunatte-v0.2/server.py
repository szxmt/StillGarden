from __future__ import annotations

import json
import mimetypes
import os
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from routes.router import max_body_bytes, route_get, route_post
from server_config import prototype_assets_root


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        if not self.path.startswith("/api/") and self.path.split("?", 1)[0].endswith((".html", ".css", ".js", "/")):
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/assets/prototype/"):
            return self.write_prototype_asset(parsed.path)

        routed = route_get(parsed.path, parsed.query)
        if routed is not None:
            payload, status = routed
            return self.write_json(payload, status)

        if parsed.path.startswith("/api/"):
            self.send_error(404)
            return

        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            max_body = max_body_bytes(parsed.path)
            if length > max_body:
                self.rfile.read(length)
                raise ValueError("请求太大，先换一张小一点的图。")
            raw_body = self.rfile.read(length).decode("utf-8")
            data = json.loads(raw_body or "{}")
            routed = route_post(parsed.path, data)
            if routed is None:
                self.send_error(404)
                return
            payload, status = routed
        except Exception as exc:
            payload = {"ok": False, "message": f"本地写入失败：{exc}"}
            status = 500
        return self.write_json(payload, status)

    def write_prototype_asset(self, path: str) -> None:
        relative = unquote(path.removeprefix("/assets/prototype/")).replace("\\", "/")
        asset_path = (prototype_assets_root() / relative).resolve()
        asset_root = prototype_assets_root().resolve()
        if asset_root not in asset_path.parents or not asset_path.is_file():
            self.send_error(404)
            return
        body = asset_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(str(asset_path))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "private, max-age=86400")
        self.end_headers()
        self.wfile.write(body)

    def write_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    root = Path(__file__).resolve().parent
    os.chdir(root)

    requested_port = int(os.environ.get("STILLGARDEN_PORT", "8877"))
    ports = [requested_port] if "STILLGARDEN_PORT" in os.environ else range(requested_port, requested_port + 10)
    server = None
    port = requested_port
    for candidate in ports:
        try:
            server = ThreadingHTTPServer(("127.0.0.1", candidate), Handler)
            port = candidate
            break
        except OSError:
            continue
    if server is None:
        print(f"无法启动本地服务：端口 {requested_port}-{requested_port + 9} 都被占用。")
        sys.exit(1)
    url = f"http://127.0.0.1:{port}/"
    print(f"月亮小窝本地原型已启动：{url}")
    print("按 Ctrl+C 停止。")
    if os.environ.get("STILLGARDEN_OPEN_BROWSER", "1") != "0":
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()