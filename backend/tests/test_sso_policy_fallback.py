"""
The test that has to pass before the portal is ever switched to ID-only.

The failure this guards against is specific: if the portal asks Strat Edge ID
"may I show a password form?" and treats no-answer as "no", then the day ID goes
down is the day nobody can get into the portal at all — and the way back in is
itself behind ID. So every unreachable case below must end with the local form
STILL ON, and the manual break-glass flag must beat anything ID says.

    python3 tests/test_sso_policy_fallback.py            # needs only `requests`

ID_URL should point at a Strat Edge ID whose `portal` app is set to id_only, and
ID_SECRET at that app's shared secret. With none given the test still runs and
proves the unreachable cases, which are the ones that lock people out.
"""

import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ID_URL = os.getenv("TEST_ID_URL", "")
ID_SECRET = os.getenv("TEST_ID_SECRET", "")
DEAD = "http://127.0.0.1:9"


def _resolve(env, keep_cache=False):
    for key in ("SSO_ID_BASE_URL", "SSO_CLIENT_SECRET", "SSO_SHARED_SECRET",
                "BREAK_GLASS_LOCAL_AUTH", "SSO_POLICY_TTL"):
        os.environ.pop(key, None)
    os.environ.update(env)
    if not keep_cache:
        for name in [m for m in list(sys.modules) if "sso_policy" in m]:
            del sys.modules[name]
    module = importlib.import_module("app.core.sso_policy")
    return module, module.policy()


def check(label, env, expect_local, keep_cache=False):
    _, resolved = _resolve(env, keep_cache=keep_cache)
    ok = resolved["local_sign_in_allowed"] is expect_local
    print(("PASS " if ok else "FAIL ") + label.ljust(60)
          + f"local={str(resolved['local_sign_in_allowed']):<5} source={resolved['source']}")
    return ok


results = []

# --- the cases that matter even with no ID to talk to -----------------------
results.append(check("ID unreachable, never asked before -> local form STAYS ON",
                     {"SSO_ID_BASE_URL": DEAD, "SSO_CLIENT_SECRET": "anything"}, True))
results.append(check("ID unreachable + break-glass -> local form STAYS ON",
                     {"SSO_ID_BASE_URL": DEAD, "SSO_CLIENT_SECRET": "anything",
                      "BREAK_GLASS_LOCAL_AUTH": "1"}, True))
results.append(check("no app secret configured -> local form STAYS ON",
                     {"SSO_ID_BASE_URL": DEAD}, True))

# --- and the cases that need a live ID whose portal app is id_only ----------
if ID_URL and ID_SECRET:
    results.append(check("ID reachable and says id_only -> local form is OFF",
                         {"SSO_ID_BASE_URL": ID_URL, "SSO_CLIENT_SECRET": ID_SECRET}, False))
    results.append(check("ID says id_only but break-glass is on -> break-glass WINS",
                         {"SSO_ID_BASE_URL": ID_URL, "SSO_CLIENT_SECRET": ID_SECRET,
                          "BREAK_GLASS_LOCAL_AUTH": "1"}, True))
    results.append(check("a wrong secret is not an answer -> local form STAYS ON",
                         {"SSO_ID_BASE_URL": ID_URL, "SSO_CLIENT_SECRET": "not-the-secret"}, True))

    # Learn id_only from ID, then take ID away with the process still running —
    # which is what an outage actually looks like. Pointing the URL at a dead
    # host would NOT test this: the module reads its URL once at import, so
    # changing the variable afterwards changes nothing. Break the fetch instead.
    module, _ = _resolve({"SSO_ID_BASE_URL": ID_URL, "SSO_CLIENT_SECRET": ID_SECRET,
                          "SSO_POLICY_TTL": "0"})
    module._fetch = lambda: None          # ID is now unreachable, mid-process
    resolved = module.policy()
    ok = resolved["local_sign_in_allowed"] is False and resolved["source"] == "cached"
    print(("PASS " if ok else "FAIL ")
          + "policy learned, then ID goes down -> the LAST ANSWER holds".ljust(60)
          + f"local={str(resolved['local_sign_in_allowed']):<5} source={resolved['source']}")
    results.append(ok)

    # ...and break-glass still gets you in from there, without ID coming back.
    os.environ["BREAK_GLASS_LOCAL_AUTH"] = "1"
    resolved = module.policy()
    ok = resolved["local_sign_in_allowed"] is True and resolved["source"] == "break_glass"
    print(("PASS " if ok else "FAIL ")
          + "ID still down, break-glass flipped -> you are back in".ljust(60)
          + f"local={str(resolved['local_sign_in_allowed']):<5} source={resolved['source']}")
    results.append(ok)
    os.environ.pop("BREAK_GLASS_LOCAL_AUTH", None)
else:
    print("\n  (set TEST_ID_URL and TEST_ID_SECRET to also prove the id_only cases)")

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
