import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent))
import ios_test_agent as agent  # noqa: E402


class TestIosTestAgent(unittest.TestCase):
    def test_sanitize_text_scrubs_keys_and_tokens(self):
        with patch.object(agent, "GEMINI_API_KEY", "AIzaSecretTestKey12345"):
            raw = (
                "503 Error for https://generativelanguage.googleapis.com/v1beta/models/"
                "gemini-3.5-flash-lite:generateContent?key=AIzaSecretTestKey12345 "
                "and Authorization: Bearer pcp_abc123.xyz"
            )
            cleaned = agent.sanitize_text(raw)
            self.assertNotIn("AIzaSecretTestKey12345", cleaned)
            self.assertNotIn("pcp_abc123.xyz", cleaned)
            self.assertIn("***REDACTED***", cleaned)

    def test_norm_to_points_clamping_and_scaling(self):
        self.assertEqual(agent.norm_to_points(500, 500, 393, 852), (196, 426))
        self.assertEqual(agent.norm_to_points(0, 0, 375, 667), (1, 1))
        self.assertEqual(agent.norm_to_points(1200, 1200, 820, 1180), (819, 1179))

    def test_flatten_ui_tree_and_find_element(self):
        sample_tree = {
            "type": "Application",
            "frame": {"x": 0, "y": 0, "width": 393, "height": 852},
            "children": [
                {
                    "type": "Button",
                    "AXLabel": "CLAIM REWARD",
                    "AXUniqueId": "claim_btn",
                    "frame": {"x": 40, "y": 600, "width": 313, "height": 50},
                    "children": [],
                }
            ],
        }
        elems = agent.flatten_ui_tree(sample_tree)
        self.assertEqual(len(elems), 2)
        self.assertTrue(elems[0]["is_root"])
        match = agent.find_element_by_label(elems, "claim reward")
        self.assertIsNotNone(match)
        self.assertAlmostEqual(match["cx"], 196.5)
        self.assertAlmostEqual(match["cy"], 625.0)

    def test_canonical_defect_key_dedup(self):
        k1 = agent.canonical_defect_key({"defect_key": "DailyStreak Modal Missing Hebrew!!"})
        self.assertEqual(k1, "dailystreak-modal-missing-hebrew")
        k2 = agent.canonical_defect_key({"screen": "Hub", "category": "safe_area", "title": "Top Icon Clipped"})
        self.assertEqual(k2, "hub-safe-area-top-icon-clipped")

    def test_tap_screen_prefers_matched_element_coords(self):
        elems = [
            {"is_root": False, "label": "CLAIM REWARD", "id": "claim", "cx": 200.0, "cy": 700.0}
        ]
        with patch.object(agent, "run_cmd", return_value=(0, "", "")) as mock_run:
            ok = agent.tap_screen(500, 500, 400, 850, target_label="CLAIM REWARD", ui_elements=elems)
            self.assertTrue(ok)
            mock_run.assert_called_once_with(
                ["axe", "tap", "-x", "200", "-y", "700", "--udid", agent.DEVICE_UDID]
            )

    def test_query_vision_agent_uses_header_and_no_fake_bug_on_503(self):
        with tempfile.TemporaryDirectory() as tmp:
            img_path = Path(tmp) / "shot.png"
            img_path.write_bytes(b"fake-image-bytes")

            err_resp = MagicMock()
            err_resp.status_code = 503

            with (
                patch.object(agent, "GEMINI_API_KEY", "test-key-999"),
                patch.object(agent.time, "sleep", return_value=None),
                patch.object(agent.requests, "post", return_value=err_resp) as mock_post,
            ):
                result, warn = agent.query_vision_agent(
                    img_path, 3, 15, 393, 852, [], [], 0, []
                )
                self.assertIsNotNone(warn)
                self.assertEqual(result["bugs"], [])
                for call in mock_post.call_args_list:
                    called_url = call.args[0]
                    called_headers = call.kwargs["headers"]
                    self.assertNotIn("?key=", called_url)
                    self.assertEqual(called_headers.get("x-goog-api-key"), "test-key-999")

    def test_upsert_github_defects_creates_and_deduplicates(self):
        bugs = [
            {
                "defect_key": "hub-clip-1",
                "severity": "major",
                "confidence": 0.92,
                "title": "Top bar clipped on iPhone SE",
                "screen": "Hub",
                "category": "safe_area",
                "description": "Currency bar overlaps top edge",
                "expected": "Safe area respected",
                "actual": "Clipped by 8pt",
                "suspected_component": "App.tsx",
                "remediation": "Use SafeAreaInsets",
                "screenshot": "small_screen_step_02.png",
                "step": 2,
            },
            {
                "defect_key": "existing-bug-2",
                "severity": "minor",
                "confidence": 0.85,
                "title": "Existing bug",
                "screen": "Settings",
                "category": "ui",
                "description": "Old issue",
                "screenshot": "small_screen_step_03.png",
                "step": 3,
            },
        ]

        get_resp = MagicMock(ok=True)
        get_resp.json.return_value = [
            {"number": 42, "body": "<!-- defect_key:existing-bug-2 -->", "html_url": "https://github.com/o/r/issues/42"}
        ]
        post_create_resp = MagicMock(ok=True, status_code=201)
        post_create_resp.json.return_value = {"number": 43, "html_url": "https://github.com/o/r/issues/43"}
        post_comment_resp = MagicMock(ok=True, status_code=201)

        with (
            patch.object(agent, "OPEN_GITHUB_DEFECTS", True),
            patch.object(agent, "GITHUB_TOKEN", "ghp_test"),
            patch.object(agent, "GITHUB_REPOSITORY", "gabayim/Zikaron3D"),
            patch.object(agent.requests, "get", return_value=get_resp),
            patch.object(agent.requests, "post", side_effect=[post_create_resp, post_comment_resp]) as mock_post,
        ):
            urls = agent.upsert_github_defects(bugs, {})
            self.assertEqual(
                urls,
                ["https://github.com/o/r/issues/43", "https://github.com/o/r/issues/42"],
            )
            self.assertIn("/issues", mock_post.call_args_list[0].args[0])
            self.assertIn("/issues/42/comments", mock_post.call_args_list[1].args[0])

    def test_upsert_paperclip_defects_skips_active(self):
        bugs = [
            {
                "defect_key": "new-defect-a",
                "severity": "critical",
                "title": "Crash on launch",
                "screen": "Hub",
                "description": "Black screen",
                "expected": "Hub renders",
                "actual": "Black screen",
                "remediation": "Fix init",
            },
            {
                "defect_key": "active-defect-b",
                "severity": "minor",
                "title": "Already tracked",
                "screen": "Shop",
            },
        ]
        get_resp = MagicMock(ok=True)
        get_resp.json.return_value = [
            {"status": "todo", "description": "<!-- defect_key:active-defect-b -->"}
        ]
        post_resp = MagicMock(ok=True)
        post_resp.json.return_value = {"identifier": "Z3D-10"}

        with (
            patch.object(agent, "PAPERCLIP_API_URL", "https://hermes.bibb.io/api"),
            patch.object(agent, "PAPERCLIP_API_KEY", "pcp_test"),
            patch.object(agent, "PAPERCLIP_COMPANY_ID", "comp-1"),
            patch.object(agent.requests, "get", return_value=get_resp),
            patch.object(agent.requests, "post", return_value=post_resp) as mock_post,
        ):
            ids = agent.upsert_paperclip_defects(bugs, ["https://github.com/o/r/issues/99"])
            self.assertEqual(ids, ["Z3D-10"])
            self.assertEqual(mock_post.call_count, 1)
            payload = mock_post.call_args.kwargs["json"]
            self.assertEqual(payload["status"], "todo")
            self.assertEqual(payload["priority"], "urgent")


if __name__ == "__main__":
    unittest.main()
