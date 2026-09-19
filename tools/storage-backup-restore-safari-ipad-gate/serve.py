#!/usr/bin/env python
"""LAN server for the Restore Safari/iPad Gate (LEARNING-RECORD-STORAGE-BACKUP-RESTORE-SAFARI-IPAD-GATE-1).

Usage:  python tools/storage-backup-restore-safari-ipad-gate/serve.py [--port N]

What it does
  1. builds the synthetic test backups (build-test-backups.js, which self-checks them with the
     real restore planner) into a temp directory OUTSIDE the repo;
  2. serves this worktree read-only on the LAN (binds 0.0.0.0, first free port from 8980 unless
     --port is given), and prints the PC's LAN IP, the port and the URLs to open on the iPad.

Safety
  * Local/LAN only. It never talks to donomana.jp and the Gate page refuses to run on it.
  * Allow-list, not "serve everything": only the page assets the dashboard needs, this Gate
    tool, and the generated test files. No directory listings, no dotfiles (.git), no docs/,
    no other tools/, no generate.js. GET/HEAD only.
  * The generated files are served as downloads (Content-Disposition: attachment) so Safari
    saves them to Files instead of showing them.
  * Stop it with Ctrl+C when the Gate is finished.
"""
import argparse
import functools
import http.server
import mimetypes
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import urllib.parse

HERE = pathlib.Path(__file__).parent.resolve()
REPO_ROOT = HERE.parent.parent
GATE_DIR = "tools/storage-backup-restore-safari-ipad-gate"
HUB_PATH = "/" + GATE_DIR + "/index.html"
ROOT_FILES = {"service-worker.js", "site.webmanifest", "manifest.webmanifest", "favicon.ico", "favicon.svg",
              "apple-touch-icon.png", "ogp.png"}
mimetypes.add_type("application/manifest+json", ".webmanifest")


def allowed(rel):
    """rel: repo-relative POSIX path without a leading slash."""
    if not rel or any(part.startswith(".") for part in rel.split("/")):
        return False
    if "/" not in rel:
        return rel.endswith(".html") or rel in ROOT_FILES
    if rel.startswith(GATE_DIR + "/"):
        return rel == GATE_DIR + "/index.html"   # only the hub page; not the server/build/rehearsal scripts
    return rel.startswith("assets/")


class Handler(http.server.SimpleHTTPRequestHandler):
    gate_files = None
    log_path = None

    def log_message(self, fmt, *args):
        # Every request is logged immediately (flushed) to the console AND a file, so a device run can be
        # reconstructed afterwards (which page/file was fetched, in what order). stdout redirected to a file
        # is block-buffered in Python, so without flush=True nothing would show up.
        import time
        line = "%s %-15s %s" % (time.strftime("%H:%M:%S"), self.client_address[0], fmt % args)
        print(line, flush=True)
        if Handler.log_path:
            with open(Handler.log_path, "a", encoding="utf-8") as f:
                f.write(line + "\n")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # never let Safari show a stale copy
        super().end_headers()

    def translate_path(self, path):
        p = urllib.parse.unquote(urllib.parse.urlparse(path).path)
        if p.startswith("/gate-files/"):
            return str(pathlib.Path(Handler.gate_files) / pathlib.PurePosixPath(p[len("/gate-files/"):]).name)
        return str(REPO_ROOT / p.lstrip("/"))

    def do_GET(self):
        self._route(super().do_GET)

    def do_HEAD(self):
        self._route(super().do_HEAD)

    def _route(self, serve):
        p = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        if p in ("", "/"):
            self.send_response(302); self.send_header("Location", HUB_PATH); self.end_headers(); return
        if p.startswith("/gate-files/"):
            name = pathlib.PurePosixPath(p[len("/gate-files/"):]).name
            if not (name == "manifest.json" or (name.endswith(".json") and name[:2].isdigit())) or not (pathlib.Path(Handler.gate_files) / name).is_file():
                self.send_error(404); return
            self._attachment = name != "manifest.json"
            return serve()
        rel = p.lstrip("/")
        if not allowed(rel) or not (REPO_ROOT / rel).is_file():
            self.send_error(404); return
        self._attachment = False
        return serve()

    def guess_type(self, path):
        return "application/json" if str(path).endswith(".json") else super().guess_type(path)

    def list_directory(self, path):
        self.send_error(403); return None


# Content-Disposition must be added before end_headers(); do it by wrapping send_response for downloads.
_orig_send_response = Handler.send_response
def _send_response(self, code, message=None):
    _orig_send_response(self, code, message)
    if code == 200 and getattr(self, "_attachment", False):
        name = pathlib.PurePosixPath(urllib.parse.unquote(urllib.parse.urlparse(self.path).path)).name
        self.send_header("Content-Disposition", 'attachment; filename="%s"' % name)
Handler.send_response = _send_response


def lan_ips():
    ips = []
    try:   # the address the OS would use to reach the LAN (no packet is sent)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("10.255.255.255", 1)); ips.append(s.getsockname()[0]); s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith("127.") and not ip.startswith("169.254."):
                ips.append(ip)
    except OSError:
        pass
    return ips


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=0, help="fixed port (default: first free port from 8980)")
    args = ap.parse_args()

    out = pathlib.Path(tempfile.gettempdir()) / "donomana-restore-gate-files"
    print("Building synthetic test backups with the real export code ...")
    r = subprocess.run(["node", str(HERE / "build-test-backups.js"), str(out)], cwd=str(REPO_ROOT))
    if r.returncode != 0:
        print("Build/self-check FAILED; not starting the server."); return 1
    Handler.gate_files = str(out)
    Handler.log_path = str(pathlib.Path(tempfile.gettempdir()) / "donomana-restore-gate-server.log")
    open(Handler.log_path, "w", encoding="utf-8").close()

    server = None
    ports = [args.port] if args.port else range(8980, 9000)
    for port in ports:
        try:
            server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler); break
        except OSError:
            continue
    if server is None:
        print("No free port found."); return 1
    port = server.server_address[1]
    ips = lan_ips() or ["<this PC's LAN IP>"]
    print("\n" + "=" * 72)
    print("Restore Safari/iPad Gate server is running (LAN only, read-only).")
    print("  worktree : %s" % REPO_ROOT)
    print("  request log: %s" % Handler.log_path)
    print("  port     : %d" % port)
    for ip in ips:
        print("  iPad URL : http://%s:%d%s" % (ip, port, HUB_PATH))
    print("  (iPad and this PC must be on the same Wi-Fi.  Stop with Ctrl+C.)")
    print("=" * 72 + "\n", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
