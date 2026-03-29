# Deploy Guide

This app is production-ready to deploy as a Docker web service.

## 1) Local production run (already tested)

```bash
cd /Users/sitrelahmustefa/resume-job-matcher
PORT=8080 .venv/bin/gunicorn --bind 127.0.0.1:8080 --workers 2 --threads 2 --timeout 60 app:app
```

Open:

- http://127.0.0.1:8080
- http://127.0.0.1:8080/health

## 2) Render deploy (recommended first public launch)

Prerequisites:

- GitHub account
- Render account
- Project pushed to GitHub

Steps:

1. Create a Git repo and push this folder to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Select the repo. Render will detect `render.yaml`.
4. Deploy. Render will build from `Dockerfile` and expose a public HTTPS URL.

## 3) Notes

- App does not require secrets for current functionality.
- Resume and job description are submitted per request and not persisted by app logic.
- If you add persistence later, add privacy policy and explicit retention settings.
