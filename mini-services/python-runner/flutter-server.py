#!/usr/bin/env python3
"""
Tiny HTTP server for Flutter web builds.

Why this exists (instead of `python3 -m http.server`):
  Flutter's built index.html contains:
      <base href="/">
      <script src="flutter.js" defer></script>
  When the iframe loads `/?XTransformPort=PORT` through Caddy, the browser
  resolves relative asset URLs against the base href `/` — DROPPING the
  `?XTransformPort=PORT` query string. The request then goes back to Next.js
  instead of the Flutter server, returning 404.

  Fix: rewrite `<base href="/">` to `<base href="/?XTransformPort=PORT">` so
  all relative URLs inherit the port query parameter. Per RFC 3986, resolving
  a relative URL against a base with a query preserves the query:
      base:    /?XTransformPort=PORT
      ref:     flutter.js
      result:  /flutter.js?XTransformPort=PORT

Usage:
  python3 flutter-server.py <port> <directory>
"""
import sys
import os
import re
import html
import mimetypes
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path


def make_handler(port: int, directory: str):
    base_re = re.compile(
        r'<base\s+href=["\']/["\']\s*/?>',
        re.IGNORECASE,
    )

    class FlutterHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=directory, **kwargs)

        def end_headers(self):
            # Allow embedding in iframe + cross-origin asset loading
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("X-Content-Type-Options", "nosniff")
            super().end_headers()

        def do_GET(self):
            # Resolve the file path
            parsed = urllib.parse.urlparse(self.path)
            path = urllib.parse.unquote(parsed.path)
            if path == "/" or path == "":
                path = "/index.html"

            # Normalize and secure the path
            full_path = Path(directory) / path.lstrip("/")
            try:
                full_path = full_path.resolve(strict=True)
                base_dir = Path(directory).resolve(strict=True)
                if base_dir not in full_path.parents and full_path != base_dir:
                    self.send_error(403, "Forbidden")
                    return
            except FileNotFoundError:
                self.send_error(404, "Not Found")
                return
            except Exception:
                self.send_error(404, "Not Found")
                return

            if not full_path.is_file():
                # If it's a directory, try index.html
                idx = full_path / "index.html"
                if idx.is_file():
                    full_path = idx
                else:
                    self.send_error(404, "Not Found")
                    return

            # Determine content type
            ctype, _ = mimetypes.guess_type(str(full_path))
            if ctype is None:
                ctype = "application/octet-stream"
            if ctype.startswith("text/") or ctype.endswith("+xml") or ctype == "application/javascript":
                charset = "utf-8"
                content_type = f"{ctype}; charset={charset}"
            else:
                charset = None
                content_type = ctype

            # Read file
            try:
                with open(full_path, "rb") as f:
                    data = f.read()
            except Exception as e:
                self.send_error(500, f"Read error: {e}")
                return

            # Rewrite HTML files to inject the XTransformPort into <base href>
            is_html = (
                full_path.suffix.lower() == ".html"
                or ctype == "text/html"
            )
            if is_html:
                try:
                    text = data.decode("utf-8", errors="replace")
                    new_text = base_re.sub(
                        f'<base href="/?XTransformPort={port}">',
                        text,
                        count=1,
                    )
                    data = new_text.encode("utf-8")
                except Exception as e:
                    sys.stderr.write(f"[flutter-server] rewrite failed: {e}\n")

            # Send response with correct Content-Length
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            # HEAD request: don't send body
            if self.command != "HEAD":
                self.wfile.write(data)

        def log_message(self, format, *args):
            sys.stderr.write("[flutter-server] %s - %s\n" % (self.address_string(), format % args))

    return FlutterHandler


def main():
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: flutter-server.py <port> <directory>\n")
        sys.exit(1)
    port = int(sys.argv[1])
    directory = sys.argv[2]
    if not os.path.isdir(directory):
        sys.stderr.write(f"Directory not found: {directory}\n")
        sys.exit(1)

    handler = make_handler(port, directory)
    server = HTTPServer(("127.0.0.1", port), handler)
    sys.stderr.write(f"[flutter-server] serving {directory} on http://127.0.0.1:{port}/\n")
    sys.stderr.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("[flutter-server] shutting down\n")
        server.shutdown()


if __name__ == "__main__":
    main()
