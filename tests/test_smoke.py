"""Smoke tests: impact API and analyze flow (temp SQLite DB)."""

from __future__ import annotations

import os
import re
import tempfile
import unittest


def _csrf_from(html: str) -> str:
    m = re.search(r'name="csrf_token" value="([^"]+)"', html)
    assert m, "csrf token not found in page"
    return m.group(1)


class AppSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._db_fd, self._db_path = tempfile.mkstemp(suffix=".db")
        os.close(self._db_fd)
        os.environ["APP_DB_PATH"] = self._db_path
        os.environ["SECRET_KEY"] = "test-secret-key-for-smoke-tests"

        import importlib

        import app as app_module

        importlib.reload(app_module)
        self.app_module = app_module
        self.app = app_module.app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def tearDown(self) -> None:
        os.unlink(self._db_path)

    def _register_and_login(self, email: str) -> None:
        r = self.client.get("/signup")
        self.client.post(
            "/signup",
            data={"email": email, "password": "password123", "csrf_token": _csrf_from(r.text)},
            follow_redirects=True,
        )
        r = self.client.get("/login")
        self.client.post(
            "/login",
            data={"email": email, "password": "password123", "csrf_token": _csrf_from(r.text)},
            follow_redirects=False,
        )

    def test_evaluate_impact_api(self) -> None:
        self._register_and_login("smoke@test.dev")
        r = self.client.get("/")
        tok = _csrf_from(r.text)
        payload = {
            "original_resume": "Java developer enterprise systems.",
            "tailored_resume": "Python developer Django REST APIs kubernetes microservices agile team.",
            "job_description": "Senior Python developer Django REST kubernetes microservices agile AWS",
            "match_result": {"correlated_score": 70.0, "match_level": "Medium match"},
        }
        r4 = self.client.post(
            "/api/evaluate-impact",
            json=payload,
            headers={"X-CSRF-Token": tok},
        )
        self.assertEqual(r4.status_code, 200, r4.get_data(as_text=True))
        data = r4.get_json()
        self.assertTrue(data.get("ok"))
        self.assertIn("impact_score", data)
        self.assertIn("ats_score_before", data)
        self.assertGreater(data["keyword_gain"], 0)

    def test_analyze_includes_impact(self) -> None:
        self._register_and_login("smoke2@test.dev")
        r2 = self.client.get("/")
        tok2 = _csrf_from(r2.text)
        resume = "Python engineer with five years building APIs django flask rest services kubernetes."
        jd = "We need senior python django rest api kubernetes docker experience."
        r3 = self.client.post(
            "/analyze",
            data={
                "csrf_token": tok2,
                "profession": "web",
                "skill_growth": "",
                "resume": resume,
                "jd": jd,
            },
        )
        self.assertEqual(r3.status_code, 200)
        body = r3.get_data(as_text=True)
        self.assertIn("Resume impact evaluation", body)
        self.assertIn("ATS proxy", body)


    def test_pipeline_v2_api(self) -> None:
        self._register_and_login("pipe@test.dev")
        r = self.client.get("/")
        tok = _csrf_from(r.text)
        body = {
            "job_description": "Senior Python engineer. Required: django, rest. Preferred: aws.",
            "resume": "Skills: python, django, flask\nExperience: Django APIs 2020-2023.",
            "include_tailoring": True,
            "include_impact": True,
        }
        resp = self.client.post(
            "/api/v2/pipeline",
            json=body,
            headers={"X-CSRF-Token": tok},
        )
        self.assertEqual(resp.status_code, 200, resp.get_data(as_text=True))
        data = resp.get_json()
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("brand"), "HireLens")
        self.assertIn("match_analysis", data)
        self.assertIn("job_data", data)

    def test_internal_pipeline_api_key(self) -> None:
        os.environ["HIRELENS_INTERNAL_API_KEY"] = "test-internal-key-smoke"
        import importlib

        import app as app_module

        importlib.reload(app_module)
        app = app_module.app
        app.config["TESTING"] = True
        client = app.test_client()
        body = {
            "job_description": "Senior Python engineer. Required: django, rest. Preferred: aws.",
            "resume": "Skills: python, django, flask\nExperience: Django APIs 2020-2023.",
            "include_tailoring": False,
            "include_impact": False,
        }
        bad = client.post("/api/internal/v2/pipeline", json=body)
        self.assertEqual(bad.status_code, 401)
        good = client.post(
            "/api/internal/v2/pipeline",
            json=body,
            headers={"X-API-Key": "test-internal-key-smoke"},
        )
        self.assertEqual(good.status_code, 200, good.get_data(as_text=True))
        data = good.get_json()
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("brand"), "HireLens")
        self.assertIn("match_analysis", data)


if __name__ == "__main__":
    unittest.main()
