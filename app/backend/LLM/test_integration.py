"""
test_integration.py — Integration tests for the LLM audit engine pipeline.

Tests the full flow:
    Nessie API (mocked) → audit_engine → ollama_client (mocked) → data_validator

Run with:
    python test_integration.py
    # or
    python -m pytest test_integration.py -v
"""

import json
import sys
import unittest
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_POLICY = (
    "Employees may not spend more than $500 per transaction on entertainment. "
    "All travel expenses above $200 require prior approval. "
    "Purchases at gambling establishments are strictly prohibited."
)

SAMPLE_TRANSACTIONS = [
    {
        "transaction_id": "tx_001",
        "amount": 750,
        "merchant": "Sky Lounge",
        "category": "Entertainment",
        "date": "2025-02-15",
    },
    {
        "transaction_id": "tx_002",
        "amount": 45,
        "merchant": "Staples",
        "category": "Office Supplies",
        "date": "2025-02-16",
    },
    {
        "transaction_id": "tx_003",
        "amount": 350,
        "merchant": "Delta Airlines",
        "category": "Travel",
        "date": "2025-02-17",
    },
]

SAMPLE_LLM_RESPONSE = {
    "audit_results": [
        {
            "transaction_id": "tx_001",
            "risk_level": "high",
            "finding": "Entertainment spend of $750 exceeds the $500 per-transaction limit.",
            "policy_violation": "Entertainment cap: max $500 per transaction.",
            "recommendation": "Seek retroactive approval or reverse the charge.",
        },
        {
            "transaction_id": "tx_002",
            "risk_level": "low",
            "finding": "Office supplies purchase is within policy.",
            "policy_violation": "none",
            "recommendation": "No action required.",
        },
        {
            "transaction_id": "tx_003",
            "risk_level": "medium",
            "finding": "Travel expense of $350 exceeds $200 threshold — prior approval required.",
            "policy_violation": "Travel expenses above $200 require prior approval.",
            "recommendation": "Confirm prior approval was obtained; if not, escalate to manager.",
        },
    ],
    "summary": "2 transactions require attention: 1 high-risk, 1 medium-risk.",
}

NESSIE_URL = "http://localhost:8000/api/transactions"


# ---------------------------------------------------------------------------
# Helper: build a mock requests.get response
# ---------------------------------------------------------------------------

def _mock_nessie_response(transactions: list[dict]) -> MagicMock:
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = transactions
    mock_resp.raise_for_status = MagicMock()
    return mock_resp


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class TestImports(unittest.TestCase):
    """Verify all modules import without errors."""

    def test_import_prompt(self):
        import prompt  # noqa: F401
        self.assertTrue(hasattr(prompt, "build_complete_audit_prompt"))
        self.assertTrue(hasattr(prompt, "AUDIT_RESPONSE_SCHEMA"))

    def test_import_data_validator(self):
        import data_validator  # noqa: F401
        self.assertTrue(hasattr(data_validator, "AuditReport"))
        self.assertTrue(hasattr(data_validator, "AuditResult"))
        self.assertTrue(hasattr(data_validator, "validate_llm_response"))
        self.assertTrue(hasattr(data_validator, "count_risk_levels"))

    def test_import_ollama_client(self):
        import ollama_client  # noqa: F401
        self.assertTrue(hasattr(ollama_client, "call_llama"))
        self.assertTrue(hasattr(ollama_client, "check_ollama_running"))
        self.assertTrue(hasattr(ollama_client, "OllamaClient"))

    def test_import_audit_engine(self):
        import audit_engine  # noqa: F401
        self.assertTrue(hasattr(audit_engine, "run_audit"))

    def test_import_routes(self):
        import routes  # noqa: F401
        self.assertTrue(hasattr(routes, "router"))


class TestPromptBuilder(unittest.TestCase):
    """Unit tests for prompt.py."""

    def setUp(self):
        from prompt import build_complete_audit_prompt
        self.build = build_complete_audit_prompt

    def test_returns_three_tuple(self):
        sys_p, usr_p, schema = self.build(SAMPLE_POLICY, SAMPLE_TRANSACTIONS)
        self.assertIsInstance(sys_p, str)
        self.assertIsInstance(usr_p, str)
        self.assertIsInstance(schema, dict)

    def test_user_prompt_contains_policy(self):
        _, usr_p, _ = self.build(SAMPLE_POLICY, SAMPLE_TRANSACTIONS)
        self.assertIn("$500", usr_p)

    def test_user_prompt_contains_transaction_ids(self):
        _, usr_p, _ = self.build(SAMPLE_POLICY, SAMPLE_TRANSACTIONS)
        self.assertIn("tx_001", usr_p)
        self.assertIn("tx_002", usr_p)

    def test_schema_has_required_fields(self):
        _, _, schema = self.build(SAMPLE_POLICY, SAMPLE_TRANSACTIONS)
        self.assertIn("audit_results", schema["properties"])
        self.assertIn("summary", schema["properties"])

    def test_empty_transactions_raises(self):
        from prompt import build_complete_audit_prompt
        with self.assertRaises(ValueError):
            build_complete_audit_prompt(SAMPLE_POLICY, [])


class TestDataValidator(unittest.TestCase):
    """Unit tests for data_validator.py."""

    def setUp(self):
        from data_validator import validate_llm_response, count_risk_levels
        self.validate = validate_llm_response
        self.count = count_risk_levels

    def test_valid_dict_returns_audit_report(self):
        from data_validator import AuditReport
        report = self.validate(SAMPLE_LLM_RESPONSE)
        self.assertIsInstance(report, AuditReport)

    def test_valid_json_string_returns_audit_report(self):
        from data_validator import AuditReport
        report = self.validate(json.dumps(SAMPLE_LLM_RESPONSE))
        self.assertIsInstance(report, AuditReport)

    def test_correct_result_count(self):
        report = self.validate(SAMPLE_LLM_RESPONSE)
        self.assertEqual(len(report.audit_results), 3)

    def test_risk_level_normalised(self):
        report = self.validate(SAMPLE_LLM_RESPONSE)
        levels = {r.risk_level for r in report.audit_results}
        self.assertTrue(levels.issubset({"high", "medium", "low"}))

    def test_invalid_json_raises_value_error(self):
        with self.assertRaises(ValueError):
            self.validate("not json at all {{{")

    def test_missing_required_field_raises(self):
        bad = {"audit_results": [], "summary": "empty"}  # empty list
        with self.assertRaises(ValueError):
            self.validate(bad)

    def test_count_risk_levels(self):
        report = self.validate(SAMPLE_LLM_RESPONSE)
        counts = self.count(report)
        self.assertEqual(counts["high_risk_count"], 1)
        self.assertEqual(counts["medium_risk_count"], 1)
        self.assertEqual(counts["low_risk_count"], 1)


class TestOllamaClient(unittest.TestCase):
    """Unit tests for ollama_client.py (mocking HTTP)."""

    def test_chat_passes_format_in_payload(self):
        """Confirm format= is included in the POST payload."""
        from ollama_client import OllamaClient

        client = OllamaClient()
        schema = {"type": "object"}

        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = {
            "message": {"content": json.dumps(SAMPLE_LLM_RESPONSE)}
        }

        with patch("ollama_client.requests.post", return_value=mock_resp) as mock_post:
            client.chat(
                messages=[{"role": "user", "content": "test"}],
                format=schema,
                temperature=0,
            )
            call_kwargs = mock_post.call_args
            payload = call_kwargs[1]["json"] if "json" in call_kwargs[1] else call_kwargs[0][1]
            self.assertIn("format", payload)
            self.assertEqual(payload["format"], schema)

    def test_call_llama_returns_dict(self):
        """call_llama() should return a parsed dict."""
        from ollama_client import call_llama

        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = {
            "message": {"content": json.dumps(SAMPLE_LLM_RESPONSE)}
        }

        with patch("ollama_client.requests.post", return_value=mock_resp):
            result = call_llama("sys prompt", "user prompt", {"type": "object"})

        self.assertIsInstance(result, dict)
        self.assertIn("audit_results", result)

    def test_call_llama_connection_error(self):
        """call_llama() should surface OllamaConnectionError on connection failure."""
        import requests as req
        from ollama_client import OllamaConnectionError, call_llama

        with patch(
            "ollama_client.requests.post",
            side_effect=req.exceptions.ConnectionError("refused"),
        ):
            with self.assertRaises(OllamaConnectionError):
                call_llama("sys", "usr", {})

    def test_check_ollama_running_true(self):
        from ollama_client import check_ollama_running

        mock_resp = MagicMock()
        mock_resp.ok = True
        with patch("ollama_client.requests.get", return_value=mock_resp):
            self.assertTrue(check_ollama_running())

    def test_check_ollama_running_false(self):
        import requests as req
        from ollama_client import check_ollama_running

        with patch(
            "ollama_client.requests.get",
            side_effect=req.exceptions.ConnectionError,
        ):
            self.assertFalse(check_ollama_running())


class TestAuditEngine(unittest.TestCase):
    """Integration tests for audit_engine.run_audit() with mocked dependencies."""

    def _run_with_mocks(
        self,
        transactions=None,
        llm_response=None,
        nessie_status=200,
    ):
        """Helper: run audit_engine.run_audit() with both external calls mocked."""
        import audit_engine

        txns = transactions if transactions is not None else SAMPLE_TRANSACTIONS
        llm = llm_response if llm_response is not None else SAMPLE_LLM_RESPONSE

        mock_get = MagicMock(return_value=_mock_nessie_response(txns))

        with (
            patch.object(audit_engine.requests, "get", mock_get),
            patch("audit_engine.call_llama", return_value=llm),
        ):
            return audit_engine.run_audit(
                username="jdoe",
                policy_text=SAMPLE_POLICY,
                nessie_endpoint_url=NESSIE_URL,
            )

    def test_full_pipeline_returns_audit_report(self):
        from data_validator import AuditReport
        report = self._run_with_mocks()
        self.assertIsInstance(report, AuditReport)

    def test_correct_number_of_results(self):
        report = self._run_with_mocks()
        self.assertEqual(len(report.audit_results), 3)

    def test_report_has_summary(self):
        report = self._run_with_mocks()
        self.assertIsInstance(report.summary, str)
        self.assertTrue(len(report.summary) > 0)

    def test_risk_levels_present(self):
        report = self._run_with_mocks()
        levels = {r.risk_level for r in report.audit_results}
        self.assertEqual(levels, {"high", "medium", "low"})

    def test_empty_transactions_raises_value_error(self):
        import audit_engine

        mock_get = MagicMock(return_value=_mock_nessie_response([]))
        with patch.object(audit_engine.requests, "get", mock_get):
            with self.assertRaises(ValueError, msg="Should raise on empty transactions"):
                audit_engine.run_audit(
                    username="jdoe",
                    policy_text=SAMPLE_POLICY,
                    nessie_endpoint_url=NESSIE_URL,
                )

    def test_nessie_connection_error_raised(self):
        import requests as req
        import audit_engine

        with patch.object(
            audit_engine.requests,
            "get",
            side_effect=req.exceptions.ConnectionError("refused"),
        ):
            with self.assertRaises(ConnectionError):
                audit_engine.run_audit("jdoe", SAMPLE_POLICY, NESSIE_URL)

    def test_nessie_called_with_username_param(self):
        """Confirm Nessie GET includes ?username=jdoe."""
        import audit_engine

        mock_get = MagicMock(return_value=_mock_nessie_response(SAMPLE_TRANSACTIONS))

        with (
            patch.object(audit_engine.requests, "get", mock_get),
            patch("audit_engine.call_llama", return_value=SAMPLE_LLM_RESPONSE),
        ):
            audit_engine.run_audit("jdoe", SAMPLE_POLICY, NESSIE_URL)

        # params= is always passed as a keyword argument in audit_engine.py
        params = mock_get.call_args.kwargs.get("params", {})
        self.assertEqual(params.get("username"), "jdoe")


class TestRoutes(unittest.TestCase):
    """Smoke tests for FastAPI routes using TestClient."""

    def setUp(self):
        try:
            from fastapi.testclient import TestClient
            from fastapi import FastAPI
            import routes

            app = FastAPI()
            app.include_router(routes.router)
            self.client = TestClient(app)
        except ImportError:
            self.skipTest("fastapi[testclient] or httpx not installed")

    def test_health_endpoint_returns_200(self):
        # Patch the name as imported inside routes.py
        with patch("routes.check_ollama_running", return_value=True):
            resp = self.client.get("/audit/health")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "ok")
        self.assertTrue(body["ollama_running"])
        self.assertEqual(body["model"], "llama3")

    def test_health_endpoint_degraded_when_ollama_down(self):
        with patch("routes.check_ollama_running", return_value=False):
            resp = self.client.get("/audit/health")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "degraded")
        self.assertFalse(body["ollama_running"])

    def test_audit_run_success(self):
        from data_validator import validate_llm_response

        mock_report = validate_llm_response(SAMPLE_LLM_RESPONSE)

        # Patch the reference inside routes, not the source module
        with patch("routes.run_audit", return_value=mock_report):
            resp = self.client.post(
                "/audit/run",
                json={
                    "username": "jdoe",
                    "policy_text": SAMPLE_POLICY,
                    "nessie_endpoint_url": NESSIE_URL,
                },
            )

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["high_risk_count"], 1)
        self.assertEqual(body["medium_risk_count"], 1)
        self.assertEqual(body["low_risk_count"], 1)
        self.assertEqual(len(body["audit_results"]), 3)

    def test_audit_run_returns_400_on_value_error(self):
        with patch("routes.run_audit", side_effect=ValueError("No transactions found")):
            resp = self.client.post(
                "/audit/run",
                json={
                    "username": "ghost",
                    "policy_text": SAMPLE_POLICY,
                    "nessie_endpoint_url": NESSIE_URL,
                },
            )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("No transactions found", resp.json()["detail"])

    def test_audit_run_returns_503_on_connection_error(self):
        with patch("routes.run_audit", side_effect=ConnectionError("Ollama not running")):
            resp = self.client.post(
                "/audit/run",
                json={
                    "username": "jdoe",
                    "policy_text": SAMPLE_POLICY,
                    "nessie_endpoint_url": NESSIE_URL,
                },
            )

        self.assertEqual(resp.status_code, 503)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("SUSpend LLM Audit Engine — Integration Test Suite")
    print("=" * 60)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    for cls in [
        TestImports,
        TestPromptBuilder,
        TestDataValidator,
        TestOllamaClient,
        TestAuditEngine,
        TestRoutes,
    ]:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    if result.wasSuccessful():
        print("ALL TESTS PASSED")
    else:
        print(f"FAILURES: {len(result.failures)}  ERRORS: {len(result.errors)}")
    print("=" * 60)

    sys.exit(0 if result.wasSuccessful() else 1)
