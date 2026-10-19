"""The Portal must send its project identity with Finance events."""

import json
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core import finance_client  # noqa: E402


class ImmediateThread:
    def __init__(self, target, daemon):
        self.target = target

    def start(self):
        self.target()


class Response:
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return b"{}"


class FinanceBridgeTest(unittest.TestCase):
    def test_project_and_expenditure_carry_portal_name(self):
        requests = []

        def capture(request, timeout):
            requests.append((request.full_url, json.loads(request.data)))
            return Response()

        project = SimpleNamespace(project_id=5, project_name="Mthashana TVET College", client="Mthashana", total_budget=1200.50)
        with patch.dict(os.environ, {"FINANCE_URL": "https://finance.example", "FINANCE_INGEST_SECRET": "test"}), \
             patch.object(finance_client.threading, "Thread", ImmediateThread), \
             patch.object(finance_client.urllib.request, "urlopen", capture):
            finance_client.notify_project(project)
            finance_client.notify_finance("portal-exp-2", 5, project.project_name, project.client,
                                          None, "Materials", "Supplies", 2000, "2026-09-21")

        self.assertEqual(requests[0][0], "https://finance.example/api/portal/project")
        self.assertEqual(requests[0][1]["projectName"], project.project_name)
        self.assertEqual(requests[0][1]["totalBudgetCents"], 120050)
        self.assertEqual(requests[1][0], "https://finance.example/api/portal/expenditure")
        self.assertEqual(requests[1][1]["projectName"], project.project_name)
        self.assertEqual(requests[1][1]["referenceId"], "portal-exp-2")


if __name__ == "__main__":
    unittest.main()
