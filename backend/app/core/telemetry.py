"""
Strat Edge telemetry — the Python drop-in client.

Copy this file into any FastAPI app in the estate (app/core/telemetry.py is the
convention) and set three environment variables:

    STRAT_EDGE_ID_URL=https://id.strategyedge.co.za
    STRAT_EDGE_SECRET=<this app's shared secret, from the ID admin dashboard>
    STRAT_EDGE_APP_KEY=portal          # portal | crm | erp | prospect

Unset config is a silent no-op, so a developer's laptop reports nothing.

TWO THINGS HERE ARE DELIBERATE AND SHOULD SURVIVE ANY REWRITE:

1. IT NEVER BLOCKS A REQUEST AND NEVER RAISES. Every send happens on a daemon
   thread and swallows its own errors. Analytics that can slow down or break an
   API is worse than no analytics: it turns a reporting nicety into an outage.
   If ID is unreachable the events are simply lost.

2. HEARTBEATS ARE THROTTLED PER PERSON. A React front end makes many API calls
   per screen, so recording one event per authenticated request would post
   thousands of times an hour and tell us nothing extra — presence is presence.
   One heartbeat per person per HEARTBEAT_SECONDS is enough for ID to measure
   how long somebody was on the system, and costs almost nothing.

Never put anything confidential in `metadata`. It is for counting and grouping
— a report's format, how many rows — never client names or free text a user
typed.
"""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.request
from typing import Any, Dict, Optional

ID_URL = (os.getenv("STRAT_EDGE_ID_URL") or "").rstrip("/")
SECRET = os.getenv("STRAT_EDGE_SECRET") or ""
APP_KEY = os.getenv("STRAT_EDGE_APP_KEY") or ""

# How often one person's presence is worth re-reporting. Chosen against ID's
# 30-minute idle window: frequent enough that one real visit never fragments
# into several, rare enough that a working day is a few hundred rows.
HEARTBEAT_SECONDS = int(os.getenv("STRAT_EDGE_HEARTBEAT_SECONDS") or 60)

_last_beat: Dict[str, float] = {}
_lock = threading.Lock()


def configured() -> bool:
    return bool(ID_URL and SECRET and APP_KEY)


def _post(payload: Dict[str, Any]) -> None:
    """The actual send. Runs on a daemon thread; must never raise."""
    try:
        request = urllib.request.Request(
            f"{ID_URL}/api/telemetry",
            data=json.dumps(payload).encode("utf-8"),
            headers={"content-type": "application/json", "x-strat-edge-secret": SECRET},
            method="POST",
        )
        urllib.request.urlopen(request, timeout=3).read()
    except Exception:
        pass  # Deliberately silent. See the note at the top of this file.


def _send(email: Optional[str], kind: str, name: str,
          path: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> None:
    if not configured() or not email:
        return
    payload = {
        "app": APP_KEY,
        "email": email,
        "events": [{"kind": kind, "name": name, "path": path, "metadata": metadata}],
    }
    # daemon=True so a shutting-down worker is never held open by a pending beat.
    threading.Thread(target=_post, args=(payload,), daemon=True).start()


def track_action(email: Optional[str], action: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    """Something a person DID. Name it the way a manager would say it."""
    _send(email, "action", action, metadata=metadata)


def page_view(email: Optional[str], path: str) -> None:
    _send(email, "page_view", path, path=path)


def sign_in(email: Optional[str]) -> None:
    _send(email, "sign_in", "Signed in")


def touch(email: Optional[str], path: Optional[str] = None) -> None:
    """
    "This person is here right now" — call it from the authentication
    dependency, on every request. The throttle is what makes that affordable:
    only the first call in each HEARTBEAT_SECONDS window actually sends.
    """
    if not configured() or not email:
        return
    now = time.monotonic()
    with _lock:
        if now - _last_beat.get(email, 0.0) < HEARTBEAT_SECONDS:
            return
        _last_beat[email] = now
    _send(email, "heartbeat", "heartbeat", path=path)
