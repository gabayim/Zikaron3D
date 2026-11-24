#!/usr/bin/env python3
"""
Zikaron3D iOS AI Test Agent
===========================
Executes multi-device exploratory and regression E2E testing on iOS Simulators.
- Captures frame screenshots via xcrun simctl
- Inspects native iOS Accessibility hierarchy via AXe (`axe describe-ui`)
- Executes real HID taps and swipes via AXe (`axe tap` / `axe swipe`)
- Evaluates visual layout, RTL, safe areas, and UX using Google Gemini Vision API
- Detects stuck UI states via perceptual frame diffing and recovers automatically
- Deduplicates defects by canonical defect_key with confidence gating
- Automatically opens/updates deduplicated defects in GitHub Issues & Paperclip

import base64
import io
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import requests

try:
    from PIL import Image, ImageChops, ImageStat
except ImportError:
    Image = None
    ImageChops = None
    ImageStat = None

# Environment Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
GEMINI_FALLBACK_MODEL = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash").strip()
QA_DASHBOARD_URL = os.environ.get("QA_DASHBOARD_URL", "https://hermes.bibb.io/qa").rstrip("/")
DEVICE_UDID = os.environ.get("DEVICE_UDID", "booted").strip()
DEVICE_NAME = os.environ.get("DEVICE_NAME", "iOS Simulator").strip()
PERSONA = os.environ.get("PERSONA", "default").strip()
BUNDLE_ID = os.environ.get("APP_BUNDLE_ID", "com.AdvBig.Zikaron3D").strip()
APP_INSTALLED = os.environ.get("APP_INSTALLED", "false").lower() == "true"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GITHUB_REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "").strip()
GITHUB_RUN_ID = os.environ.get("GITHUB_RUN_ID", "").strip()
GITHUB_RUN_URL = os.environ.get("GITHUB_RUN_URL", "").strip()
GITHUB_SHA = os.environ.get("GITHUB_SHA", "").strip()
OPEN_GITHUB_DEFECTS = os.environ.get("OPEN_GITHUB_DEFECTS", "true").lower() == "true"

PAPERCLIP_API_URL = os.environ.get("PAPERCLIP_API_URL", "").rstrip("/")
PAPERCLIP_API_KEY = os.environ.get("PAPERCLIP_API_KEY", "").strip()
PAPERCLIP_COMPANY_ID = os.environ.get("PAPERCLIP_COMPANY_ID", "").strip()
PAPERCLIP_PROJECT_ID = os.environ.get("PAPERCLIP_PROJECT_ID", "").strip()

CONFIDENCE_THRESHOLD = float(os.environ.get("DEFECT_CONFIDENCE_THRESHOLD", "0.75"))
OUT_DIR = Path("test-output")

# Logical iOS point dimensions (portrait) for normalized [0..1000] -> point coordinate mapping
DEVICE_POINTS: dict[str, tuple[int, int]] = {
    "iPhone SE (3rd generation)": (375, 667),
    "iPhone 16 Pro": (402, 874),
    "iPhone 16": (393, 852),
    "iPad Air 11-inch (M2)": (820, 1180),
}

PERSONA_PROFILES = {
    "small_screen": {
        "title": "Compact Screen Persona (iPhone SE)",
        "goal": (
            "1) Dismiss any startup modal (e.g. Daily Streak 'CLAIM REWARD'). "
            "2) Inspect the Hub for text/icon clipping or overlap on 375x667pt. "
            "3) Tap Hub icons (Profile, Collection, Settings, Shop, Leaderboard) and verify modal/screen fit. "
            "4) Swipe/tap a World portal (e.g. Meadow) to launch gameplay, verify controls, then tap top-left back button."
        ),
        "max_steps": 16,
    },
    "flagship": {
        "title": "Flagship Display Persona (iPhone 16 Pro)",
        "goal": (
            "1) Dismiss startup modals ('CLAIM REWARD'). "
            "2) Check Dynamic Island & home indicator safe-area padding on Hub, CurrencyBar, and game headers. "
            "3) Cycle modes (TOYBOX/ARCADE/SANCTUARY) or open Settings/Shop/Collection. "
            "4) Enter at least 2 game portals via swipe + tap and verify smooth back navigation."
        ),
        "max_steps": 18,
    },
    "tablet": {
        "title": "Tablet Persona (iPad Air M2)",
        "goal": (
            "1) Dismiss startup modals ('CLAIM REWARD'). "
            "2) Verify iPad aspect ratio adaptability: modal max-width centering, Hub portal sizing, "
            "and touch-target spacing. "
            "3) Enter Collection/Shop and at least one game world to confirm no stretched/clipped canvas."
        ),
        "max_steps": 16,
    },
    "rtl_hebrew": {
        "title": "RTL Hebrew Localization Persona",
        "goal": (
            "1) Inspect startup modals and Hub under Hebrew (he_IL) RTL system locale. "
            "2) Check whether text is localized into Hebrew or left untranslated in English, "
            "and verify RTL directional layout (back buttons, chevrons, icon order, text truncation). "
            "3) Tap through modals and Hub screens so each screen is audited once."
        ),
        "max_steps": 14,
    },
}

active_profile = PERSONA_PROFILES.get(
    PERSONA,
    {
        "title": f"Custom Persona ({PERSONA})",
        "goal": "Perform exploratory verification of startup modals, Hub navigation, settings, and a game world.",
        "max_steps": 15,
    },
)


def log(msg: str) -> None:
    timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{timestamp}] [Agent-{PERSONA}] {sanitize_text(msg)}", flush=True)


def sanitize_text(text: str) -> str:
    """Scrub API keys and bearer tokens from any log or dashboard output."""
    if not text:
        return ""
    cleaned = re.sub(r"([?&]key=)[^&\s\"']+", r"\1***REDACTED***", text)
    cleaned = re.sub(r"(Bearer\s+)[A-Za-z0-9._\-]+", r"\1***REDACTED***", cleaned)
    if GEMINI_API_KEY and len(GEMINI_API_KEY) > 6:
        cleaned = cleaned.replace(GEMINI_API_KEY, "***REDACTED***")
    return cleaned


def run_cmd(cmd: list[str], timeout: int = 15) -> tuple[int, str, str]:
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return res.returncode, res.stdout.strip(), res.stderr.strip()
    except Exception as exc:
        return 1, "", sanitize_text(str(exc))


def run_simctl(cmd_args: list[str]) -> str:
    code, out, err = run_cmd(["xcrun", "simctl"] + cmd_args, timeout=20)
    if code != 0 and err:
        log(f"simctl error on '{' '.join(cmd_args)}': {err}")
    return out


def capture_screenshot(step_idx: int) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    file_name = f"{PERSONA}_step_{step_idx:02d}.png"
    target_path = OUT_DIR / file_name
    run_simctl(["io", DEVICE_UDID, "screenshot", "--mask=black", str(target_path)])
    if not target_path.exists():
        run_simctl(["io", DEVICE_UDID, "screenshot", str(target_path)])
    return target_path


def get_logical_screen_size(image_path: Path, ui_elements: list[dict[str, Any]]) -> tuple[int, int]:
    """Determine device logical points (width, height) for accurate tap coordinates."""
    for elem in ui_elements:
        if elem.get("is_root") and elem.get("width", 0) > 200 and elem.get("height", 0) > 200:
            return int(elem["width"]), int(elem["height"])

    if DEVICE_NAME in DEVICE_POINTS:
        return DEVICE_POINTS[DEVICE_NAME]

    if Image is not None and image_path.exists():
        try:
            with Image.open(image_path) as img:
                w, h = img.size
                scale = 2.0 if "iPad" in DEVICE_NAME or "SE" in DEVICE_NAME or w <= 750 else 3.0
                return int(round(w / scale)), int(round(h / scale))
        except Exception:
            pass
    return 393, 852


def flatten_ui_tree(node: Any, depth: int = 0, out: Optional[list[dict[str, Any]]] = None) -> list[dict[str, Any]]:
    """Extract compact interactive/labeled accessibility elements from AXe describe-ui JSON."""
    if out is None:
        out = []
    if isinstance(node, list):
        for item in node:
            flatten_ui_tree(item, depth, out)
        return out
    if not isinstance(node, dict):
        return out

    frame = node.get("frame") or {}
    w = float(frame.get("width") or 0)
    h = float(frame.get("height") or 0)
    x = float(frame.get("x") or 0)
    y = float(frame.get("y") or 0)

    label = node.get("AXLabel") or node.get("title") or node.get("AXTitle") or ""
    identifier = node.get("AXUniqueId") or node.get("identifier") or ""
    role = node.get("type") or node.get("role") or ""

    if depth == 0 and w > 200 and h > 200:
        out.append({"is_root": True, "role": role, "x": x, "y": y, "width": w, "height": h})
    elif (label or identifier or role in {"Button", "Link", "TextField", "Switch"}) and w > 0 and h > 0:
        out.append({
            "role": role,
            "label": str(label)[:80],
            "id": str(identifier)[:60],
            "x": round(x, 1),
            "y": round(y, 1),
            "width": round(w, 1),
            "height": round(h, 1),
            "cx": round(x + w / 2.0, 1),
            "cy": round(y + h / 2.0, 1),
        })

    for child in node.get("children") or []:
        if len(out) >= 60:
            break
        flatten_ui_tree(child, depth + 1, out)
    return out


def get_ui_tree() -> list[dict[str, Any]]:
    """Query native iOS Simulator Accessibility hierarchy via AXe."""
    code, out, err = run_cmd(["axe", "describe-ui", "--udid", DEVICE_UDID], timeout=10)
    if code != 0 or not out:
        if err:
            log(f"axe describe-ui unavailable: {err}")
        return []
    try:
        parsed = json.loads(out)
        return flatten_ui_tree(parsed)
    except Exception:
        return []


def norm_to_points(x_norm: float, y_norm: float, screen_w: int, screen_h: int) -> tuple[int, int]:
    """Convert normalized [0..1000] coordinates to clamped logical device points."""
    x_clamped = max(0.0, min(1000.0, float(x_norm)))
    y_clamped = max(0.0, min(1000.0, float(y_norm)))
    px = int(round((x_clamped / 1000.0) * screen_w))
    py = int(round((y_clamped / 1000.0) * screen_h))
    return max(1, min(screen_w - 1, px)), max(1, min(screen_h - 1, py))


def find_element_by_label(ui_elements: list[dict[str, Any]], label: str) -> Optional[dict[str, Any]]:
    if not label:
        return None
    target = label.strip().lower()
    for elem in ui_elements:
        if elem.get("is_root"):
            continue
        el_label = (elem.get("label") or "").strip().lower()
        el_id = (elem.get("id") or "").strip().lower()
        if el_label == target or el_id == target:
            return elem
    for elem in ui_elements:
        if elem.get("is_root"):
            continue
        el_label = (elem.get("label") or "").strip().lower()
        if target in el_label and el_label:
            return elem
    return None


def tap_screen(
    x_norm: Optional[float],
    y_norm: Optional[float],
    screen_w: int,
    screen_h: int,
    target_label: Optional[str] = None,
    ui_elements: Optional[list[dict[str, Any]]] = None,
) -> bool:
    """Execute a genuine touch tap in the iOS Simulator via AXe."""
    ui_elements = ui_elements or []

    # 1. Exact Accessibility element center if matched
    matched = find_element_by_label(ui_elements, target_label or "")
    if matched:
        pt_x, pt_y = int(round(matched["cx"])), int(round(matched["cy"]))
        log(f"Tapping matched UI element '{matched.get('label') or matched.get('id')}' at ({pt_x}, {pt_y}) pt")
        code, _, err = run_cmd(["axe", "tap", "-x", str(pt_x), "-y", str(pt_y), "--udid", DEVICE_UDID])
        if code == 0:
            return True
        log(f"axe coordinate tap failed ({err}), trying --label fallback")

    # 2. Direct AXe label lookup
    if target_label:
        code, _, _ = run_cmd(["axe", "tap", "--label", target_label, "--udid", DEVICE_UDID])
        if code == 0:
            log(f"Tapped element via AXe label '{target_label}'")
            return True

    # 3. Normalized [0..1000] -> logical device point tap
    if x_norm is not None and y_norm is not None:
        pt_x, pt_y = norm_to_points(x_norm, y_norm, screen_w, screen_h)
        log(f"Executing AXe tap at norm ({x_norm}, {y_norm}) -> ({pt_x}, {pt_y}) pt on {screen_w}x{screen_h}")
        code, _, err = run_cmd(["axe", "tap", "-x", str(pt_x), "-y", str(pt_y), "--udid", DEVICE_UDID])
        if code == 0:
            return True
        log(f"AXe tap failed: {err}")

    return False


def swipe_screen(
    x1_norm: float,
    y1_norm: float,
    x2_norm: float,
    y2_norm: float,
    screen_w: int,
    screen_h: int,
) -> bool:
    sx, sy = norm_to_points(x1_norm, y1_norm, screen_w, screen_h)
    ex, ey = norm_to_points(x2_norm, y2_norm, screen_w, screen_h)
    log(f"Executing AXe swipe ({sx},{sy}) -> ({ex},{ey}) pt")
    code, _, err = run_cmd(
        [
            "axe",
            "swipe",
            "--start-x",
            str(sx),
            "--start-y",
            str(sy),
            "--end-x",
            str(ex),
            "--end-y",
            str(ey),
            "--duration",
            "0.4",
            "--udid",
            DEVICE_UDID,
        ]
    )
    if code != 0 and err:
        log(f"AXe swipe failed: {err}")
    return code == 0


def frame_diff_score(prev_path: Optional[Path], curr_path: Path) -> float:
    """Compute mean absolute pixel difference [0..255] on a 64x64 grayscale thumbnail."""
    if Image is None or ImageChops is None or ImageStat is None:
        return 100.0
    if not prev_path or not prev_path.exists() or not curr_path.exists():
        return 100.0
    try:
        with Image.open(prev_path) as a, Image.open(curr_path) as b:
            ta = a.convert("L").resize((64, 64))
            tb = b.convert("L").resize((64, 64))
            diff = ImageChops.difference(ta, tb)
            return float(ImageStat.Stat(diff).mean[0])
    except Exception:
        return 100.0


def encode_optimized_image(image_path: Path, max_dim: int = 1024, quality: int = 86) -> str:
    if Image is not None and image_path.exists():
        try:
            with Image.open(image_path) as img:
                img.thumbnail((max_dim, max_dim))
                buf = io.BytesIO()
                img.convert("RGB").save(buf, format="JPEG", quality=quality)
                return base64.b64encode(buf.getvalue()).decode("utf-8")
        except Exception:
            pass
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def report_to_dashboard(endpoint: str, data: dict[str, Any]) -> None:
    if not QA_DASHBOARD_URL:
        return
    try:
        url = f"{QA_DASHBOARD_URL}/api/{endpoint}"
        requests.post(url, json=data, timeout=5)
    except Exception:
        pass


def launch_app() -> None:
    if APP_INSTALLED:
        log(f"Launching installed app: {BUNDLE_ID}")
        run_simctl(["terminate", DEVICE_UDID, BUNDLE_ID])
        time.sleep(0.5)
        run_simctl(["launch", DEVICE_UDID, BUNDLE_ID])
        time.sleep(3.5)
    else:
        log("App binary was not installed (running simulator health check mode).")


def open_deeplink(url: str) -> None:
    log(f"Opening deep-link: {url}")
    run_simctl(["openurl", DEVICE_UDID, url])
    time.sleep(2.0)


def canonical_defect_key(bug: dict[str, Any]) -> str:
    raw_key = str(bug.get("defect_key") or "").strip().lower()
    if raw_key:
        slug = re.sub(r"[^a-z0-9\-]+", "-", raw_key).strip("-")
        if slug:
            return slug[:80]
    screen = re.sub(r"[^a-z0-9]+", "-", str(bug.get("screen") or "unknown").lower()).strip("-")
    category = re.sub(r"[^a-z0-9]+", "-", str(bug.get("category") or "ui").lower()).strip("-")
    title = re.sub(r"[^a-z0-9]+", "-", str(bug.get("title") or "defect").lower()).strip("-")
    return f"{screen}-{category}-{title}"[:80]


def format_ui_tree_for_prompt(ui_elements: list[dict[str, Any]], screen_w: int, screen_h: int) -> str:
    items = []
    for el in ui_elements:
        if el.get("is_root"):
            continue
        nx = int(round((el["cx"] / max(1, screen_w)) * 1000))
        ny = int(round((el["cy"] / max(1, screen_h)) * 1000))
        items.append(
            f"- role={el.get('role')} label={json.dumps(el.get('label'))} "
            f"id={json.dumps(el.get('id'))} center_norm=({nx},{ny}) "
            f"frame_pt=({el['x']},{el['y']},{el['width']}x{el['height']})"
        )
    if not items:
        return "(No native AX elements exposed — likely full-screen Skia canvas; use visual normalized coords [0..1000].)"
    return "\n".join(items[:35])


def query_vision_agent(
    image_path: Path,
    step_idx: int,
    max_steps: int,
    screen_w: int,
    screen_h: int,
    ui_elements: list[dict[str, Any]],
    history_summary: list[str],
    unchanged_streak: int,
    known_defect_keys: list[str],
) -> tuple[dict[str, Any], Optional[str]]:
    """Query Google Gemini Vision API with structured defect schema. Returns (result_dict, infra_warning)."""
    if not GEMINI_API_KEY:
        return (
            {
                "status": "completed",
                "screen_name": "Unknown",
                "bugs": [],
                "action": "done",
                "reasoning": "GEMINI_API_KEY is not configured; stopping safely without false bug reports.",
            },
            "Missing GEMINI_API_KEY environment variable.",
        )

    b64_image = encode_optimized_image(image_path, max_dim=1024, quality=86)
    ui_context = format_ui_tree_for_prompt(ui_elements, screen_w, screen_h)
    recent_actions = "\n".join(history_summary[-5:]) if history_summary else "None (first step)."

    stuck_note = ""
    if unchanged_streak >= 1:
        stuck_note = (
            f"\n⚠️ CRITICAL NAVIGATION NOTICE: The screen did NOT visually change after the previous action "
            f"(unchanged_streak={unchanged_streak}). Do NOT repeat the exact same tap coordinates! "
            f"Choose a different target_label, shifted coordinates, swipe, or recovery action."
        )

    prompt = f"""
You are an expert senior iOS QA engineer testing the mobile game 'Zikaron3D' (Expo / React Native + Skia 2D).
Device: {DEVICE_NAME} | Logical Screen: {screen_w}x{screen_h}pt | Persona: {active_profile['title']}
Step: {step_idx}/{max_steps}
Test Journey Goal: {active_profile['goal']}

INTENTIONAL DESIGN RULES (DO NOT FLAG AS BUGS):
- In-game gameplay canvases (Critter Burrows, Orb Merge, Star Catcher, Shell Shuffle, Vine Flow, Beat Circuit, Echo Peaks) use Skia 2D and are intentionally TEXT-FREE and CARD-FREE (icons, colors, motion only). Do NOT report "missing text" during gameplay.
- Dark cosmic glass UI (#05010F / #0F172A) is intentional.
- Only report GENUINE, HIGH-CONFIDENCE defects (confidence >= 0.75):
  * Cut-off / clipped / overlapping text or buttons
  * Unreachable or off-screen interactive targets
  * Dynamic Island / notch / home indicator overlap with interactive UI
  * Crash, frozen screen, blank white/black error state, or unhandled error modal
  * Missing/broken sprite or image asset
  * For persona `rtl_hebrew`: untranslated English UI strings in React Native modals/screens or broken RTL directional layout/arrows.

ALREADY LOGGED DEFECT KEYS IN THIS RUN (do not re-report unless severity escalated):
{json.dumps(known_defect_keys)}

RECENT STEP HISTORY:
{recent_actions}
{stuck_note}

NATIVE ACCESSIBILITY TREE (extracted from live simulator):
{ui_context}

COORDINATE SYSTEM:
- Provide `tap_coords` or `swipe_coords` in NORMALIZED [0..1000] coordinates relative to the screenshot image: (0,0) = top-left, (1000,1000) = bottom-right.
- When tapping a visible button/control from the Accessibility Tree or screenshot, also set `target_label` to its exact label if known.

Respond STRICTLY with valid JSON matching this schema:
{{
  "status": "ok" | "bug" | "stuck" | "completed",
  "screen_name": "Short PascalCase screen/modal name e.g. DailyStreakModal, Hub, Settings, CritterBurrows",
  "bugs": [
    {{
      "defect_key": "lowercase-slug-identifying-unique-bug",
      "screen": "ScreenName",
      "category": "layout_overflow" | "safe_area" | "rtl_localization" | "missing_asset" | "crash_freeze" | "touch_target" | "interaction_blocker" | "visual_glitch",
      "severity": "critical" | "major" | "minor",
      "confidence": 0.90,
      "title": "Concise, specific bug title",
      "description": "Exact visual/functional defect observed",
      "expected": "Expected layout or behavior",
      "actual": "Actual observed layout or behavior",
      "suspected_component": "Likely source file e.g. src/ui/DailyStreakModal.tsx or src/scenes/Hub.tsx",
      "remediation": "Specific technical fix suggestion"
    }}
  ],
  "action": "tap" | "swipe" | "wait" | "done",
  "target_label": "Exact label of button to tap or null",
  "tap_coords": {{"x": 500, "y": 850}} or null,
  "swipe_coords": {{"x1": 800, "y1": 500, "x2": 200, "y2": 500}} or null,
  "reasoning": "One concise sentence explaining what is on screen and why you chose the next action."
}}
"""

    models_to_try = [GEMINI_MODEL]
    if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_MODEL:
        models_to_try.append(GEMINI_FALLBACK_MODEL)

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": b64_image}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    last_err = ""
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
        }
        for attempt in range(3):
            try:
                log(f"Querying Google Gemini Vision API ({model}, attempt {attempt + 1})...")
                res = requests.post(url, headers=headers, json=payload, timeout=35)
                if res.status_code in (429, 500, 502, 503, 504):
                    last_err = f"HTTP {res.status_code} from {model}"
                    time.sleep(1.5 * (2**attempt))
                    continue
                res.raise_for_status()
                data = res.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                parsed = json.loads(raw_text)
                if not isinstance(parsed, dict):
                    raise ValueError("Model returned non-object JSON")
                return parsed, None
            except Exception as exc:
                last_err = sanitize_text(str(exc))
                if attempt < 2:
                    time.sleep(1.5 * (2**attempt))

    log(f"Gemini Vision API infra warning after retries: {last_err}")
    return (
        {
            "status": "ok",
            "screen_name": "Unknown",
            "bugs": [],
            "action": "done" if step_idx >= 3 else "wait",
            "reasoning": f"Vision API temporarily unavailable ({last_err}); continuing safely.",
        },
        last_err,
    )


def perform_stuck_recovery(ui_elements: list[dict[str, Any]], screen_w: int, screen_h: int) -> None:
    """Attempt deterministic recovery when UI stays frozen across consecutive steps."""
    recovery_labels = ["CLAIM REWARD", "CONTINUE", "OK", "CLOSE", "DONE", "CANCEL", "BACK"]
    for label in recovery_labels:
        elem = find_element_by_label(ui_elements, label)
        if elem:
            log(f"Stuck recovery: tapping UI button '{elem.get('label')}'")
            tap_screen(None, None, screen_w, screen_h, target_label=elem.get("label"), ui_elements=ui_elements)
            return

    # Fallback: tap top-left back button region or bottom modal CTA region
    log("Stuck recovery: tapping modal CTA / back fallback region")
    tap_screen(500, 760, screen_w, screen_h, ui_elements=ui_elements)
    time.sleep(0.6)
    swipe_screen(820, 500, 180, 500, screen_w, screen_h)


def upsert_github_defects(bugs: list[dict[str, Any]], summary_data: dict[str, Any]) -> list[str]:
    """Open or update deduplicated GitHub Issues for verified defects."""
    if not OPEN_GITHUB_DEFECTS or not GITHUB_TOKEN or not GITHUB_REPOSITORY or not bugs:
        return []

    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    base = f"https://api.github.com/repos/{GITHUB_REPOSITORY}"

    existing_by_key: dict[str, dict[str, Any]] = {}
    try:
        resp = requests.get(
            f"{base}/issues",
            headers=headers,
            params={"state": "open", "labels": "qa-defect", "per_page": 100},
            timeout=15,
        )
        if resp.ok:
            for issue in resp.json():
                body = issue.get("body") or ""
                m = re.search(r"<!--\s*defect_key:([a-z0-9\-]+)\s*-->", body)
                if m:
                    existing_by_key[m.group(1)] = issue
    except Exception as exc:
        log(f"Warning: could not fetch existing GitHub issues: {sanitize_text(str(exc))}")

    opened_urls: list[str] = []
    run_link = GITHUB_RUN_URL or "GitHub Actions run"

    for bug in bugs:
        key = bug["defect_key"]
        sev = bug.get("severity", "minor").lower()
        marker = f"<!-- defect_key:{key} -->"

        if key in existing_by_key:
            issue = existing_by_key[key]
            num = issue["number"]
            comment_body = (
                f"Still reproducing in `{PERSONA}` (`{DEVICE_NAME}`) on step {bug.get('step')}.\n"
                f"- **Run**: {run_link}\n"
                f"- **Commit**: `{GITHUB_SHA[:7] if GITHUB_SHA else 'unknown'}`\n"
                f"- **Screenshot**: `{bug.get('screenshot')}` (in workflow artifact `ios-test-report-{PERSONA}`)"
            )
            try:
                c_resp = requests.post(
                    f"{base}/issues/{num}/comments",
                    headers=headers,
                    json={"body": comment_body},
                    timeout=15,
                )
                if c_resp.ok:
                    log(f"Updated existing GitHub defect #{num} for key '{key}'")
                    opened_urls.append(issue.get("html_url", ""))
            except Exception as exc:
                log(f"Warning: failed updating issue #{num}: {sanitize_text(str(exc))}")
            continue

        issue_title = f"[QA][{sev.upper()}][{PERSONA}] {bug['title']}"[:240]
        issue_body = (
            f"{marker}\n"
            f"## Automated iOS AI QA Defect\n\n"
            f"- **Defect Key**: `{key}`\n"
            f"- **Severity**: `{sev}`\n"
            f"- **Confidence**: `{bug.get('confidence', 0.85):.2f}`\n"
            f"- **Device / Persona**: `{DEVICE_NAME}` (`{PERSONA}`)\n"
            f"- **Screen**: `{bug.get('screen', 'Unknown')}`\n"
            f"- **Category**: `{bug.get('category', 'ui')}`\n"
            f"- **Suspected Component**: `{bug.get('suspected_component') or 'TBD'}`\n"
            f"- **Commit**: `{GITHUB_SHA[:7] if GITHUB_SHA else 'unknown'}`\n"
            f"- **Run**: {run_link}\n"
            f"- **Artifact**: `ios-test-report-{PERSONA}` -> `test-output/{bug.get('screenshot')}`\n\n"
            f"### Description\n{bug.get('description') or bug.get('reasoning')}\n\n"
            f"### Expected vs Actual\n"
            f"- **Expected**: {bug.get('expected') or 'N/A'}\n"
            f"- **Actual**: {bug.get('actual') or 'N/A'}\n\n"
            f"### Recommended Remediation\n{bug.get('remediation') or 'Inspect component layout and safe areas.'}\n"
        )
        labels = ["qa-defect", "ios", f"severity:{sev}", f"persona:{PERSONA}"]

        try:
            create_resp = requests.post(
                f"{base}/issues",
                headers=headers,
                json={"title": issue_title, "body": issue_body, "labels": labels},
                timeout=15,
            )
            if create_resp.status_code == 422:
                # Fallback if custom labels aren't allowed/created yet
                create_resp = requests.post(
                    f"{base}/issues",
                    headers=headers,
                    json={"title": issue_title, "body": issue_body},
                    timeout=15,
                )
            if create_resp.ok:
                created = create_resp.json()
                log(f"Opened GitHub defect #{created.get('number')}: {created.get('html_url')}")
                opened_urls.append(created.get("html_url", ""))
            else:
                log(f"GitHub issue creation returned {create_resp.status_code}: {sanitize_text(create_resp.text[:300])}")
        except Exception as exc:
            log(f"Warning: failed creating GitHub issue for '{key}': {sanitize_text(str(exc))}")

    return [u for u in opened_urls if u]


def upsert_paperclip_defects(bugs: list[dict[str, Any]], github_urls: list[str]) -> list[str]:
    """Create/deduplicate defect issues in Paperclip (hermes.bibb.io) when configured."""
    if not PAPERCLIP_API_URL or not PAPERCLIP_API_KEY or not PAPERCLIP_COMPANY_ID or not bugs:
        return []

    headers = {
        "Authorization": f"Bearer {PAPERCLIP_API_KEY}",
        "Content-Type": "application/json",
    }
    existing_keys: set[str] = set()
    try:
        r = requests.get(
            f"{PAPERCLIP_API_URL}/companies/{PAPERCLIP_COMPANY_ID}/issues",
            headers=headers,
            timeout=15,
        )
        if r.ok:
            for item in r.json():
                if item.get("status") in ("done", "cancelled"):
                    continue
                desc = item.get("description") or ""
                m = re.search(r"<!--\s*defect_key:([a-z0-9\-]+)\s*-->", desc)
                if m:
                    existing_keys.add(m.group(1))
    except Exception as exc:
        log(f"Warning: Paperclip issue lookup failed: {sanitize_text(str(exc))}")

    sev_to_priority = {"critical": "urgent", "major": "high", "minor": "medium"}
    created_ids: list[str] = []

    for idx, bug in enumerate(bugs):
        key = bug["defect_key"]
        if key in existing_keys:
            log(f"Paperclip defect '{key}' already active; skipping duplicate.")
            continue

        sev = bug.get("severity", "minor").lower()
        gh_ref = github_urls[idx] if idx < len(github_urls) else GITHUB_RUN_URL
        payload: dict[str, Any] = {
            "title": f"[QA][{sev.upper()}][{PERSONA}] {bug['title']}"[:200],
            "description": (
                f"<!-- defect_key:{key} -->\n"
                f"**Source**: iOS AI Test Agent (`{DEVICE_NAME}` / `{PERSONA}`)\n"
                f"**Screen**: `{bug.get('screen', 'Unknown')}`\n"
                f"**Suspected Component**: `{bug.get('suspected_component') or 'TBD'}`\n"
                f"**GitHub Ref**: {gh_ref or 'N/A'}\n\n"
                f"### Description\n{bug.get('description') or bug.get('reasoning')}\n\n"
                f"### Expected vs Actual\n- Expected: {bug.get('expected')}\n- Actual: {bug.get('actual')}\n\n"
                f"### Suggested Fix\n{bug.get('remediation')}\n"
            ),
            "status": "todo",
            "priority": sev_to_priority.get(sev, "medium"),
        }
        if PAPERCLIP_PROJECT_ID:
            payload["projectId"] = PAPERCLIP_PROJECT_ID

        try:
            cr = requests.post(
                f"{PAPERCLIP_API_URL}/companies/{PAPERCLIP_COMPANY_ID}/issues",
                headers=headers,
                json=payload,
                timeout=15,
            )
            if cr.ok:
                created = cr.json()
                issue_id = created.get("identifier") or created.get("id")
                log(f"Created Paperclip defect {issue_id} for '{key}'")
                created_ids.append(str(issue_id))
            else:
                log(f"Paperclip issue create returned {cr.status_code}: {sanitize_text(cr.text[:250])}")
        except Exception as exc:
            log(f"Warning: Paperclip defect creation failed: {sanitize_text(str(exc))}")

    return created_ids


def run_test_loop() -> None:
    log(f"Starting test loop: {active_profile['title']}")
    log(f"Objective: {active_profile['goal']}")

    report_to_dashboard(
        "event",
        {
            "persona": PERSONA,
            "device": DEVICE_NAME,
            "run_id": GITHUB_RUN_ID,
            "reset": True,
            "step": 0,
            "max_steps": active_profile["max_steps"],
            "status": "running",
            "observation": "Booting iOS simulator and launching Zikaron3D...",
        },
    )

    launch_app()

    bugs_by_key: dict[str, dict[str, Any]] = {}
    step_history: list[dict[str, Any]] = []
    history_summary: list[str] = []
    infra_warnings: list[str] = []
    max_steps = active_profile["max_steps"]

    prev_screenshot: Optional[Path] = None
    unchanged_streak = 0

    for step in range(1, max_steps + 1):
        log(f"--- Step {step}/{max_steps} ---")
        screenshot_path = capture_screenshot(step)
        ui_elements = get_ui_tree()
        screen_w, screen_h = get_logical_screen_size(screenshot_path, ui_elements)

        if prev_screenshot is not None:
            diff = frame_diff_score(prev_screenshot, screenshot_path)
            if diff < 1.5:
                unchanged_streak += 1
                log(f"Screen visually unchanged (diff={diff:.2f}, unchanged_streak={unchanged_streak})")
            else:
                unchanged_streak = 0
        prev_screenshot = screenshot_path

        thumb_b64 = encode_optimized_image(screenshot_path, max_dim=480, quality=78)
        report_to_dashboard(
            "event",
            {
                "persona": PERSONA,
                "device": DEVICE_NAME,
                "run_id": GITHUB_RUN_ID,
                "step": step,
                "max_steps": max_steps,
                "status": "evaluating",
                "observation": f"Analyzing live frame ({screen_w}x{screen_h}pt) with Gemini Vision...",
                "screenshot": f"data:image/jpeg;base64,{thumb_b64}",
            },
        )

        evaluation, infra_warn = query_vision_agent(
            screenshot_path,
            step,
            max_steps,
            screen_w,
            screen_h,
            ui_elements,
            history_summary,
            unchanged_streak,
            list(bugs_by_key.keys()),
        )
        if infra_warn:
            infra_warnings.append(f"Step {step}: {infra_warn}")

        reasoning = sanitize_text(str(evaluation.get("reasoning") or "No explanation provided."))
        screen_name = str(evaluation.get("screen_name") or "Unknown")
        log(f"[{screen_name}] Observation: {reasoning}")

        step_bugs_found: list[dict[str, Any]] = []
        raw_bugs = evaluation.get("bugs") or []
        if not raw_bugs and evaluation.get("status") == "bug" and evaluation.get("bug"):
            raw_bugs = [
                {
                    "defect_key": "",
                    "screen": screen_name,
                    "category": "visual_glitch",
                    "severity": evaluation.get("severity") or "minor",
                    "confidence": evaluation.get("confidence", 0.85),
                    "title": evaluation["bug"],
                    "description": reasoning,
                    "remediation": evaluation.get("remediation"),
                }
            ]

        for raw_bug in raw_bugs:
            if not isinstance(raw_bug, dict) or not raw_bug.get("title"):
                continue
            conf = float(raw_bug.get("confidence", 0.85))
            if conf < CONFIDENCE_THRESHOLD:
                log(f"Ignoring low-confidence finding ({conf:.2f} < {CONFIDENCE_THRESHOLD}): {raw_bug.get('title')}")
                continue

            dkey = canonical_defect_key(raw_bug)
            if dkey in bugs_by_key:
                continue

            bug_entry = {
                "defect_key": dkey,
                "step": step,
                "screen": raw_bug.get("screen") or screen_name,
                "category": raw_bug.get("category") or "ui",
                "severity": (raw_bug.get("severity") or "minor").lower(),
                "confidence": conf,
                "title": sanitize_text(str(raw_bug["title"])),
                "description": sanitize_text(str(raw_bug.get("description") or reasoning)),
                "expected": sanitize_text(str(raw_bug.get("expected") or "")),
                "actual": sanitize_text(str(raw_bug.get("actual") or "")),
                "suspected_component": sanitize_text(str(raw_bug.get("suspected_component") or "")),
                "remediation": sanitize_text(str(raw_bug.get("remediation") or "")),
                "screenshot": screenshot_path.name,
                "reasoning": reasoning,
            }
            bugs_by_key[dkey] = bug_entry
            step_bugs_found.append(bug_entry)
            log(f"⚠️ VERIFIED DEFECT [{bug_entry['severity'].upper()}] ({dkey}): {bug_entry['title']}")

        step_record = {
            "step": step,
            "screen": screen_name,
            "screenshot": screenshot_path.name,
            "evaluation": evaluation,
        }
        step_history.append(step_record)

        action = str(evaluation.get("action") or "wait").lower()
        target_label = evaluation.get("target_label")
        history_summary.append(f"Step {step} [{screen_name}]: action={action} target={target_label} -> {reasoning}")

        # Report latest event to QA Dashboard (only send newly discovered bug, not duplicates)
        first_new_bug = step_bugs_found[0] if step_bugs_found else None
        report_to_dashboard(
            "event",
            {
                "persona": PERSONA,
                "device": DEVICE_NAME,
                "run_id": GITHUB_RUN_ID,
                "step": step,
                "max_steps": max_steps,
                "status": "bug" if first_new_bug else evaluation.get("status", "ok"),
                "observation": reasoning,
                "bug": first_new_bug["title"] if first_new_bug else None,
                "severity": first_new_bug["severity"] if first_new_bug else None,
                "screenshot": f"data:image/jpeg;base64,{thumb_b64}",
            },
        )

        if action == "done" or evaluation.get("status") == "completed":
            log("Agent determined test journey is completed.")
            break

        if unchanged_streak >= 3:
            perform_stuck_recovery(ui_elements, screen_w, screen_h)
            unchanged_streak = 0
        elif action == "tap":
            coords = evaluation.get("tap_coords") or {}
            tap_screen(
                coords.get("x"),
                coords.get("y"),
                screen_w,
                screen_h,
                target_label=target_label,
                ui_elements=ui_elements,
            )
        elif action == "swipe":
            sc = evaluation.get("swipe_coords") or {"x1": 820, "y1": 500, "x2": 180, "y2": 500}
            swipe_screen(
                sc.get("x1", 820),
                sc.get("y1", 500),
                sc.get("x2", 180),
                sc.get("y2", 500),
                screen_w,
                screen_h,
            )
        elif action == "deeplink":
            open_deeplink("zikaron3d://")

        time.sleep(1.8)

    deduped_bugs = list(bugs_by_key.values())
    generate_reports(deduped_bugs, step_history, infra_warnings)


def generate_reports(bugs: list[dict[str, Any]], history: list[dict[str, Any]], warnings: list[str]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    log("Compiling reports and opening defects if needed...")

    summary_data: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "run_id": GITHUB_RUN_ID,
        "commit": GITHUB_SHA,
        "device": DEVICE_NAME,
        "persona": PERSONA,
        "persona_title": active_profile["title"],
        "app_installed": APP_INSTALLED,
        "total_steps": len(history),
        "total_bugs": len(bugs),
        "critical_bugs": len([b for b in bugs if b.get("severity") == "critical"]),
        "major_bugs": len([b for b in bugs if b.get("severity") == "major"]),
        "minor_bugs": len([b for b in bugs if b.get("severity") == "minor"]),
        "warnings": warnings,
        "bugs": bugs,
        "history": history,
    }

    github_urls = upsert_github_defects(bugs, summary_data)
    paperclip_ids = upsert_paperclip_defects(bugs, github_urls)
    summary_data["github_defects"] = github_urls
    summary_data["paperclip_defects"] = paperclip_ids

    json_path = OUT_DIR / f"summary_{PERSONA}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)

    md_path = OUT_DIR / f"report_{PERSONA}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# iOS AI Test Report: {active_profile['title']}\n\n")
        f.write(f"- **Device**: `{DEVICE_NAME}` (`{DEVICE_UDID}`)\n")
        f.write(f"- **Persona**: `{PERSONA}`\n")
        f.write(f"- **App Installed**: `{'Yes' if APP_INSTALLED else 'No (Simulated Environment Check)'}`\n")
        f.write(f"- **Completed Steps**: {len(history)}\n")
        f.write(f"- **Timestamp**: `{summary_data['timestamp']}`\n\n")

        f.write("## 🎯 Test Goal\n")
        f.write(f"> {active_profile['goal']}\n\n")

        f.write("## 📊 Summary of Findings (Deduplicated)\n")
        if not bugs:
            f.write("✅ **No verified UI defects or layout regressions detected during this test run.**\n\n")
        else:
            f.write(f"Found **{len(bugs)}** unique verified defect(s):\n")
            f.write(f"- 🔴 **Critical**: {summary_data['critical_bugs']}\n")
            f.write(f"- 🟠 **Major**: {summary_data['major_bugs']}\n")
            f.write(f"- 🟡 **Minor**: {summary_data['minor_bugs']}\n\n")

            if github_urls:
                f.write("### 🎫 Opened / Updated GitHub Defects\n")
                for url in github_urls:
                    f.write(f"- {url}\n")
                f.write("\n")

            f.write("### 🐛 Itemized Defect List\n\n")
            for idx, bug in enumerate(bugs, 1):
                sev = bug.get("severity", "minor").upper()
                icon = "🔴" if sev == "CRITICAL" else ("🟠" if sev == "MAJOR" else "🟡")
                f.write(f"#### {idx}. {icon} [{sev}] {bug['title']}\n")
                f.write(f"- **Defect Key**: `{bug['defect_key']}`\n")
                f.write(f"- **Screen**: `{bug.get('screen')}` (Step {bug['step']})\n")
                f.write(f"- **Confidence**: `{bug.get('confidence', 0.85):.2f}`\n")
                f.write(f"- **Description**: {bug.get('description')}\n")
                if bug.get("suspected_component"):
                    f.write(f"- **Suspected Component**: `{bug['suspected_component']}`\n")
                if bug.get("remediation"):
                    f.write(f"- **Recommended Fix**: {bug['remediation']}\n")
                f.write(f"- **Screenshot**: `test-output/{bug['screenshot']}`\n\n")

        if warnings:
            f.write("## ⚠️ Infrastructure Notes\n")
            for w in warnings:
                f.write(f"- {sanitize_text(w)}\n")
            f.write("\n")

        f.write("## 📸 Step Execution Gallery\n\n")
        f.write("| Step | Screen | Observation | Screenshot |\n")
        f.write("| :--- | :--- | :--- | :--- |\n")
        for h in history:
            ev = h["evaluation"]
            obs = sanitize_text(str(ev.get("reasoning", "-"))).replace("|", "/")
            f.write(f"| Step {h['step']} | `{h.get('screen', '-')}` | {obs} | `{h['screenshot']}` |\n")

    report_to_dashboard(
        "report",
        {
            "persona": PERSONA,
            "device": DEVICE_NAME,
            "run_id": GITHUB_RUN_ID,
            "summary": summary_data,
            "markdown": md_path.read_text(encoding="utf-8") if md_path.exists() else "",
        },
    )

    log(f"Report generated successfully: {md_path}")


if __name__ == "__main__":
    run_test_loop()
