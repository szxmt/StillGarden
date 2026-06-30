from __future__ import annotations

import json
import urllib.error
import urllib.request

def request_json(
    url: str,
    api_key: str | None = None,
    timeout: int = 8,
    method: str = "GET",
    body: dict | None = None,
    extra_headers: dict | None = None,
) -> tuple[int, dict]:
    headers = {"Accept": "application/json"}
    if extra_headers:
        headers.update({str(key): str(value) for key, value in extra_headers.items() if value is not None})
    payload = None
    if body is not None:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read(1_000_000).decode("utf-8", errors="replace")
            return response.status, json.loads(raw or "{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read(200_000).decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            payload = {"message": raw}
        return exc.code, payload
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return 0, {"message": str(exc)}
