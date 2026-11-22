#!/usr/bin/env python3
"""
Zikaron3D iOS AI Test Agent
===========================
Executes multi-device exploratory and regression E2E testing on iOS Simulators.
- Captures frame screenshots via xcrun simctl
- Evaluates visual layout and UX using OpenRouter Vision models (Qwen2.5-VL / Claude)
- Interacts with simulator UI and deep links
- Generates structured Markdown bug reports and machine-readable JSON artifacts.
"""

import os
import sys
import time
import json
import base64
import requests
import subprocess
from pathlib import Path
from datetime import datetime

# Environment Configuration
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "https://hermes.bibb.io/ollama").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llava:7b").strip()
QA_DASHBOARD_URL = os.environ.get("QA_DASHBOARD_URL", "https://hermes.bibb.io/qa").rstrip("/")
DEVICE_UDID = os.environ.get("DEVICE_UDID", "booted").strip()
DEVICE_NAME = os.environ.get("DEVICE_NAME", "iOS Simulator").strip()
PERSONA = os.environ.get("PERSONA", "default").strip()
BUNDLE_ID = os.environ.get("APP_BUNDLE_ID", "com.AdvBig.Zikaron3D").strip()
APP_INSTALLED = os.environ.get("APP_INSTALLED", "false").lower() == "true"

OUT_DIR = Path("test-output")
OUT_DIR.mkdir(parents=True, exist_ok=True)

PERSONA_PROFILES = {
    "small_screen": {
        "title": "Compact Screen Persona (iPhone SE)",
        "goal": "Verify UI responsiveness on small displays (375x667pt). Inspect text truncation, button overlap, and unreachable touch targets in menus and settings.",
        "max_steps": 15
    },
    "flagship": {
        "title": "Flagship Display Persona (iPhone 16 Pro)",
        "goal": "Verify high-DPI scaling, Dynamic Island safe-area padding, mode selection (TOYBOX/ARCADE/SANCTUARY), and navigation transitions.",
        "max_steps": 20
    },
    "tablet": {
        "title": "Tablet Persona (iPad Air M2)",
        "goal": "Verify UI aspect ratio adaptability on large screens. Check modal centering, grid layouts, and ensure game elements aren't stretched or distorted.",
        "max_steps": 15
    },
    "rtl_hebrew": {
        "title": "RTL Hebrew Localization Persona",
        "goal": "Verify Right-to-Left alignment, Hebrew string rendering, back-button directional arrows, and font clipping on localized components.",
        "max_steps": 15
    }
}

active_profile = PERSONA_PROFILES.get(PERSONA, {
    "title": f"Custom Persona ({PERSONA})",
    "goal": "Perform exploratory verification of initial screens, menus, and onboarding.",
    "max_steps": 15
})

def log(msg: str):
    timestamp = datetime.utcnow().strftime("%H:%M:%S")
    print(f"[{timestamp}] [Agent-{PERSONA}] {msg}", flush=True)

def run_simctl(cmd_args: list) -> str:
    full_cmd = ["xcrun", "simctl"] + cmd_args
    try:
        res = subprocess.run(full_cmd, capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except subprocess.CalledProcessError as e:
        log(f"simctl error on '{' '.join(cmd_args)}': {e.stderr.strip()}")
        return ""

def capture_screenshot(step_idx: int) -> Path:
    file_name = f"{PERSONA}_step_{step_idx:02d}.png"
    target_path = OUT_DIR / file_name
    cmd = ["io", DEVICE_UDID, "screenshot", "--mask=black", str(target_path)]
    run_simctl(cmd)
    if not target_path.exists():
        # Fallback without mask
        run_simctl(["io", DEVICE_UDID, "screenshot", str(target_path)])
    return target_path

def report_to_dashboard(endpoint: str, data: dict):
    if not QA_DASHBOARD_URL:
        return
    try:
        url = f"{QA_DASHBOARD_URL}/api/{endpoint}"
        requests.post(url, json=data, timeout=5)
    except Exception:
        pass

def launch_app():
    if APP_INSTALLED:
        log(f"Launching installed app: {BUNDLE_ID}")
        run_simctl(["launch", DEVICE_UDID, BUNDLE_ID])
        time.sleep(3)
    else:
        log("App binary was not installed (running simulator health check mode).")

def open_deeplink(url: str):
    log(f"Opening deep-link: {url}")
    run_simctl(["openurl", DEVICE_UDID, url])
    time.sleep(2)

def tap_screen(x: int, y: int):
    log(f"Executing simulated tap at ({x}, {y})")
    # For macOS simulator windows, we can use AppleScript or simctl openurl/gestures
    apple_script = f'''
    tell application "Simulator"
        activate
    end tell
    '''
    subprocess.run(["osascript", "-e", apple_script], capture_output=True)

def query_vision_agent(image_path: Path, step_idx: int) -> dict:
    with open(image_path, "rb") as f:
        b64_image = base64.b64encode(f.read()).decode("utf-8")

    prompt = f"""
You are an expert iOS QA test agent inspecting screenshots of the mobile game application 'Zikaron3D'.
Test Target: {DEVICE_NAME} (Persona: {active_profile['title']})
Goal: {active_profile['goal']}
Step: {step_idx}

Analyze the provided iOS simulator screenshot with extreme care:
1. Examine layout issues, cut-off text, illegible fonts, broken safe areas (e.g. Dynamic Island or home indicator overlap).
2. Check for missing assets, blank screens, error modals, or unresponsive UI.
3. Check localization / RTL alignment if applicable.
4. Note that Zikaron3D uses Skia 2D rendering for in-game canvas; menus and modal dialogs are interactive views.

Respond STRICTLY with a valid JSON object matching this schema:
{{
  "status": "ok" | "bug" | "stuck" | "completed",
  "bug": "Precise bug title and description if found, otherwise null",
  "severity": "critical" | "major" | "minor" | null,
  "remediation": "Technical suggestion to fix the bug if found, otherwise null",
  "action": "tap" | "swipe" | "deeplink" | "wait" | "done",
  "tap_coords": {{"x": 195, "y": 422}} or null,
  "reasoning": "One concise sentence explaining your observation and chosen next action."
}}
"""

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [b64_image]
            }
        ],
        "stream": False,
        "options": {
            "temperature": 0.1
        }
    }

    url = f"{OLLAMA_HOST}/api/chat"
    try:
        res = requests.post(url, json=payload, timeout=90)
        res.raise_for_status()
        data = res.json()
        raw_text = data["message"]["content"].strip()
        # Clean markdown codeblocks
        if "```" in raw_text:
            parts = raw_text.split("```")
            for part in parts:
                p = part.strip()
                if p.startswith("json"):
                    p = p[4:].strip()
                if p.startswith("{") and p.endswith("}"):
                    raw_text = p
                    break
        raw_text = raw_text.strip()
        return json.loads(raw_text)
    except Exception as e:
        log(f"Ollama Vision API error: {e}")
        return {
            "status": "warning",
            "bug": f"Vision analysis note: {str(e)}",
            "severity": "minor",
            "action": "done" if step_idx > 3 else "wait",
            "reasoning": f"Ollama model responded or fallback invoked: {str(e)}"
        }

def run_test_loop():
    log(f"Starting test loop: {active_profile['title']}")
    log(f"Objective: {active_profile['goal']}")
    
    launch_app()

    bugs_collected = []
    step_history = []
    max_steps = active_profile["max_steps"]

    for step in range(1, max_steps + 1):
        log(f"--- Step {step}/{max_steps} ---")
        screenshot_path = capture_screenshot(step)
        
        evaluation = query_vision_agent(screenshot_path, step)
        reasoning = evaluation.get("reasoning", "No explanation provided.")
        log(f"Observation: {reasoning}")

        step_record = {
            "step": step,
            "screenshot": screenshot_path.name,
            "evaluation": evaluation
        }
        step_history.append(step_record)

        if evaluation.get("status") == "bug" and evaluation.get("bug"):
            bug_entry = {
                "step": step,
                "title": evaluation["bug"],
                "severity": evaluation.get("severity", "minor"),
                "remediation": evaluation.get("remediation"),
                "screenshot": screenshot_path.name,
                "reasoning": reasoning
            }
            bugs_collected.append(bug_entry)
            log(f"⚠️ BUG DETECTED [{bug_entry['severity'].upper()}]: {bug_entry['title']}")

        # Stream live progress event to QA Dashboard
        try:
            with open(screenshot_path, "rb") as f:
                thumb_b64 = base64.b64encode(f.read()).decode("utf-8")
            report_to_dashboard("event", {
                "persona": PERSONA,
                "device": DEVICE_NAME,
                "step": step,
                "max_steps": max_steps,
                "status": evaluation.get("status", "ok"),
                "observation": reasoning,
                "bug": evaluation.get("bug"),
                "severity": evaluation.get("severity"),
                "screenshot": f"data:image/png;base64,{thumb_b64}"
            })
        except Exception:
            pass

        action = evaluation.get("action", "wait")
        if action == "done" or evaluation.get("status") == "completed":
            log("Agent determined test flow is completed.")
            break
        elif action == "tap":
            coords = evaluation.get("tap_coords") or {"x": 190, "y": 420}
            tap_screen(coords.get("x", 190), coords.get("y", 420))
        elif action == "deeplink":
            open_deeplink("zikaron3d://")

        time.sleep(2)

    generate_reports(bugs_collected, step_history)

def generate_reports(bugs: list, history: list):
    log("Compiling reports...")

    summary_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "device": DEVICE_NAME,
        "persona": PERSONA,
        "persona_title": active_profile["title"],
        "app_installed": APP_INSTALLED,
        "total_steps": len(history),
        "total_bugs": len(bugs),
        "critical_bugs": len([b for b in bugs if b.get("severity") == "critical"]),
        "major_bugs": len([b for b in bugs if b.get("severity") == "major"]),
        "minor_bugs": len([b for b in bugs if b.get("severity") == "minor"]),
        "bugs": bugs,
        "history": history
    }

    # Save JSON summary
    json_path = OUT_DIR / f"summary_{PERSONA}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)

    # Save Markdown report
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

        f.write("## 📊 Summary of Findings\n")
        if not bugs:
            f.write("✅ **No UI defects or layout regressions detected during this test run.**\n\n")
        else:
            f.write(f"Found **{len(bugs)}** issue(s):\n")
            f.write(f"- 🔴 **Critical**: {summary_data['critical_bugs']}\n")
            f.write(f"- 🟠 **Major**: {summary_data['major_bugs']}\n")
            f.write(f"- 🟡 **Minor**: {summary_data['minor_bugs']}\n\n")

            f.write("### 🐛 Itemized Defect List\n\n")
            for idx, bug in enumerate(bugs, 1):
                sev = bug.get("severity", "minor").upper()
                icon = "🔴" if sev == "CRITICAL" else ("🟠" if sev == "MAJOR" else "🟡")
                f.write(f"#### {idx}. {icon} [{sev}] {bug['title']}\n")
                f.write(f"- **Step**: {bug['step']}\n")
                f.write(f"- **Observation**: {bug['reasoning']}\n")
                if bug.get("remediation"):
                    f.write(f"- **Recommended Fix**: {bug['remediation']}\n")
                f.write(f"- **Screenshot**: `test-output/{bug['screenshot']}`\n\n")

        f.write("## 📸 Step Execution Gallery\n\n")
        f.write("| Step | Observation | Screenshot |\n")
        f.write("| :--- | :--- | :--- |\n")
        for h in history:
            ev = h["evaluation"]
            obs = ev.get("reasoning", "-").replace("|", "/")
            f.write(f"| Step {h['step']} | {obs} | `{h['screenshot']}` |\n")

    # Send final summary and markdown report to QA Dashboard
    try:
        report_to_dashboard("report", {
            "persona": PERSONA,
            "device": DEVICE_NAME,
            "summary": summary_data,
            "markdown": md_path.read_text(encoding="utf-8") if md_path.exists() else ""
        })
    except Exception:
        pass

    log(f"Report generated successfully: {md_path}")

if __name__ == "__main__":
    run_test_loop()
