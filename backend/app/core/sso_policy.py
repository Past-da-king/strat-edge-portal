"""
Whether this portal is still allowed to show its own password form.

Strat Edge ID owns that decision — it is one column on the app registry, so it
can be changed from the admin dashboard without a deploy. But asking ID over the
network cannot be the ONLY thing standing between a person and a login screen,
because the moment ID is unreachable is exactly the moment someone needs the
local form. A naive "ask ID, and if it doesn't answer assume ID-only" bricks the
portal during an ID outage with no way back in.

So the answer is resolved in this order, and the first one that can speak wins:

  1. BREAK_GLASS_LOCAL_AUTH=1 in this service's own environment. No network, no
     ID, no cache. Flipped by hand on Render during an incident and set back to 0
     afterwards. Because it is server-side environment and not a request header,
     nobody outside can trigger it.
  2. The last policy ID actually answered with, cached in this process.
  3. The compiled-in default below — which is PERMISSIVE, deliberately. A fresh
     container that has never reached ID must fail towards "you can still get
     in", not towards a locked door.

Only case 2 can ever switch the local form off. That is the point.
"""

import os
import time
from typing import Optional

import requests

ID_BASE_URL = os.getenv("SSO_ID_BASE_URL", "https://id.strategyedge.co.za")
APP_KEY = os.getenv("SSO_APP_KEY", "portal")

# ID guards the policy endpoint with the same secret it signs this app's tokens
# with — SSO_CLIENT_SECRET here. SSO_SHARED_SECRET is the same string on the way
# back (it is what ID presents when it reads our /auth/roles/), so accept either.
APP_SECRET = os.getenv("SSO_CLIENT_SECRET") or os.getenv("SSO_SHARED_SECRET")

# What we believe when we have never successfully asked. Permissive on purpose.
COMPILED_DEFAULT_LOCAL_ALLOWED = True

# Long, because this is a policy that changes about once a year, and every
# refresh is a chance to be told nothing.
CACHE_TTL_SECONDS = int(os.getenv("SSO_POLICY_TTL", "3600"))

_cache: dict = {"local_allowed": None, "auth_mode": None, "fetched_at": 0.0}


def break_glass_enabled() -> bool:
    """The manual override. Nothing else in this file can turn it off."""
    return os.getenv("BREAK_GLASS_LOCAL_AUTH", "").strip() in {"1", "true", "yes", "on"}


def _fetch() -> Optional[dict]:
    """Ask ID once. Any failure at all returns None — never an assumption."""
    if not APP_SECRET:
        return None
    try:
        res = requests.get(
            f"{ID_BASE_URL}/api/apps/{APP_KEY}/policy",
            headers={"X-Strat-Edge-Secret": APP_SECRET},
            timeout=6,
        )
        if res.status_code != 200:
            return None
        data = res.json()
        if "localSignInAllowed" not in data:
            return None
        return data
    except Exception:
        return None


def policy() -> dict:
    """
    The resolved policy, with how it was resolved — the `source` field is there
    so an operator staring at a login screen can tell whether they are looking at
    ID's answer, a stale cache, or the fallback.
    """
    if break_glass_enabled():
        return {"local_sign_in_allowed": True, "auth_mode": "break_glass", "source": "break_glass"}

    fresh = None
    if time.time() - _cache["fetched_at"] > CACHE_TTL_SECONDS:
        fresh = _fetch()
        if fresh is not None:
            _cache.update(
                local_allowed=bool(fresh["localSignInAllowed"]),
                auth_mode=fresh.get("authMode"),
                fetched_at=time.time(),
            )

    if _cache["local_allowed"] is not None:
        return {
            "local_sign_in_allowed": _cache["local_allowed"],
            "auth_mode": _cache["auth_mode"],
            "source": "strat-edge-id" if fresh is not None else "cached",
        }

    return {
        "local_sign_in_allowed": COMPILED_DEFAULT_LOCAL_ALLOWED,
        "auth_mode": None,
        "source": "compiled-default",
    }


def local_sign_in_allowed() -> bool:
    return bool(policy()["local_sign_in_allowed"])
