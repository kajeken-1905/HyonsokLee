#!/usr/bin/env python3
"""로컬 웹 서버 — HTML/JSON 정적 파일 제공 (CORS 문제 해결용)"""

import http.server
import socketserver
import os
import webbrowser
from functools import partial

PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


def main():
    os.chdir(DIR)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print(f"서버 실행: http://localhost:{PORT}")
        print(f"메인 페이지: {url}")
        print(f"맛집 페이지: http://localhost:{PORT}/daegu-food.html")
        print("종료: Ctrl+C")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        httpd.serve_forever()


if __name__ == "__main__":
    main()
