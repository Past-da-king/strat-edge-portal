"""Push a logged expenditure to Strat Edge Finance.

The Portal stays the place a PM logs spend; Finance is the ledger. Every
expenditure created here is mirrored into Finance so all money lives in one
place. This is deliberately fire-and-forget: if Finance is unreachable the
Portal must still save the expenditure, so nothing here may raise.

Configured with two env vars on the Portal service:
  FINANCE_URL            e.g. https://finance-chi-ruby.vercel.app
  FINANCE_INGEST_SECRET  the same value set on the Finance app
Until both are set this is a silent no-op.
"""

import json
import logging
import os
import threading
import urllib.request

log = logging.getLogger("portal.finance")


def notify_finance(
    external_id: str,
    project_id,
    activity_id,
    category,
    description,
    amount,
    spend_date,
) -> None:
    base = (os.getenv("FINANCE_URL") or "").rstrip("/")
    secret = os.getenv("FINANCE_INGEST_SECRET") or ""
    if not base or not secret:
        return  # not configured yet — stay a no-op rather than half-working

    payload = {
        "portalProjectId": str(project_id),
        "activityRef": str(activity_id) if activity_id is not None else None,
        "category": category,
        "description": description,
        "referenceId": external_id,
        "amount": float(amount or 0),
        "spendDate": str(spend_date) if spend_date else None,
    }

    def _post() -> None:
        try:
            req = urllib.request.Request(
                base + "/api/portal/expenditure",
                data=json.dumps(payload).encode("utf-8"),
                headers={"content-type": "application/json", "x-portal-secret": secret},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp.read()
        except Exception as exc:  # analytics must never break the Portal
            log.warning("finance notify failed for %s: %s", external_id, exc)

    threading.Thread(target=_post, daemon=True).start()
