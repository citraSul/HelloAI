#!/usr/bin/env python3
from __future__ import annotations

import html
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

from matcher import keyword_gaps, overall_match_score, shared_keywords

HOST = "127.0.0.1"
PORT = 8765

PAGE = """<!DOCTYPE html>
<html lang=\"en\"> 
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Resume ↔ Job match</title>
  <style>
    :root { font-family: system-ui, sans-serif; line-height: 1.45; }
    body { max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.35rem; }
    .muted { color: #555; font-size: 0.9rem; }
    textarea { width: 100%; min-height: 200px; padding: 0.6rem; font: inherit; box-sizing: border-box; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 720px) { .row { grid-template-columns: 1fr; } }
    button { padding: 0.5rem 1rem; font: inherit; cursor: pointer; }
    .score { font-size: 1.5rem; font-weight: 600; margin: 0.5rem 0; }
    ul { margin: 0.3rem 0; padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>Resume ↔ job description matcher</h1>
  <p class=\"muted\">Local-only run. Does not auto-apply or connect to LinkedIn.</p>
  <form method=\"post\" action=\"/analyze\">
    <div class=\"row\">
      <div>
        <label for=\"resume\"><strong>Your resume</strong></label>
        <textarea id=\"resume\" name=\"resume\" placeholder=\"Paste resume\"></textarea>
      </div>
      <div>
        <label for=\"jd\"><strong>Job description</strong></label>
        <textarea id=\"jd\" name=\"jd\" placeholder=\"Paste posting\"></textarea>
      </div>
    </div>
    <p><button type=\"submit\">Analyze match</button></p>
  </form>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        if self.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(PAGE.encode())
        else:
            self.send_error(404)

    def do_POST(self) -> None:
        if self.path != "/analyze":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8", errors="replace")
        data = parse_qs(body, keep_blank_values=True)
        resume = (data.get("resume") or [""])[0]
        jd = (data.get("jd") or [""])[0]

        if not resume.strip() or not jd.strip():
            self._html_response("<p>Please provide both resume and job description.</p>", resume, jd)
            return

        score = overall_match_score(resume, jd)
        gaps, extra = keyword_gaps(resume, jd)
        shared = shared_keywords(resume, jd)

        gaps_html = "".join(f"<li><strong>{html.escape(t)}</strong> (×{c} in posting)</li>" for t, c in gaps)
        shared_html = "".join(
            f"<li><strong>{html.escape(t)}</strong> — resume ×{rc}, posting ×{jc}</li>" for t, rc, jc in shared[:15]
        )
        extra_html = ""
        if extra:
            extra_html = "<h3>Resume terms less common in this posting</h3><ul>"
            extra_html += "".join(f"<li>{html.escape(t)} (×{c} in resume)</li>" for t, c in extra)
            extra_html += "</ul>"

        result = f"""
  <p class=\"score\">Match score: {score:.1f} / 100</p>
  <div class=\"row\">
    <div>
      <h3>Keywords to add or emphasize</h3>
      <ul>{gaps_html or "<li>(none standout)</li>"}</ul>
    </div>
    <div>
      <h3>Overlap</h3>
      <ul>{shared_html or "<li>(none)</li>"}</ul>
    </div>
  </div>
  {extra_html}
"""
        self._html_response(result, resume, jd)

    def _html_response(self, inner: str, resume: str, jd: str) -> None:
        out = f"""<!DOCTYPE html>
<html lang=\"en\">
<head><meta charset=\"utf-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" /></head>
<body style=\"max-width:960px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.45\">
  <p><a href=\"/\">← Back</a></p>
  <h1>Analysis</h1>
  {inner}
  <hr />
  <h3>Edit and re-run</h3>
  <form method=\"post\" action=\"/analyze\">
    <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:1rem\">
      <div><label>Resume</label><textarea name=\"resume\" style=\"width:100%;min-height:140px\">{html.escape(resume)}</textarea></div>
      <div><label>Job description</label><textarea name=\"jd\" style=\"width:100%;min-height:140px\">{html.escape(jd)}</textarea></div>
    </div>
    <p><button type=\"submit\">Analyze again</button></p>
  </form>
</body>
</html>
"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(out.encode())


def main() -> None:
    server = HTTPServer((HOST, PORT), Handler)
    print(f"Open http://{HOST}:{PORT} in your browser (Ctrl+C to stop)")
    server.serve_forever()


if __name__ == "__main__":
    main()
