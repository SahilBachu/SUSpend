"""
audit_engine.py — Orchestrates the full LLM-powered audit pipeline.

Steps:
1. Fetch transactions from the Nessie API (teammate's endpoint).
2. Build prompts via prompt.build_complete_audit_prompt().
3. Call the LLM via ollama_client.call_llama().
4. Validate the response via data_validator.validate_llm_response().
5. Return a typed AuditReport.
"""

import logging

import requests

from data_validator import AuditReport, validate_llm_response
from ollama_client import OllamaConnectionError, OllamaGenerationError, call_llama
from prompt import build_complete_audit_prompt

logger = logging.getLogger(__name__)

# Default request timeout for the Nessie API call (seconds)
NESSIE_TIMEOUT = 15


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_audit(
    username: str,
    policy_text: str,
    nessie_endpoint_url: str,
) -> AuditReport:
    """
    Run a full LLM audit for a given user against a spending policy.

    Args:
        username:             The account username whose transactions are audited.
        policy_text:          Plain-text spending policy to enforce.
        nessie_endpoint_url:  URL of the Nessie API endpoint that returns
                              transactions for the user (GET, ?username=...).

    Returns:
        A validated AuditReport containing findings and a summary.

    Raises:
        ValueError:           Missing or invalid transactions / LLM output.
        ConnectionError:      Nessie API or Ollama server unreachable.
        requests.Timeout:     Nessie API request timed out.
    """
    # ------------------------------------------------------------------
    # Step 1 — Fetch transactions from Nessie
    # ------------------------------------------------------------------
    logger.info("run_audit | username=%s | fetching transactions from %s", username, nessie_endpoint_url)

    try:
        resp = requests.get(
            nessie_endpoint_url,
            params={"username": username},
            timeout=NESSIE_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError as exc:
        logger.error("Cannot reach Nessie endpoint %s: %s", nessie_endpoint_url, exc)
        raise ConnectionError(
            f"Nessie API is unreachable at {nessie_endpoint_url}: {exc}"
        ) from exc
    except requests.exceptions.Timeout as exc:
        logger.error("Nessie request timed out after %ds", NESSIE_TIMEOUT)
        raise requests.Timeout(
            f"Nessie API timed out after {NESSIE_TIMEOUT}s"
        ) from exc
    except requests.exceptions.HTTPError as exc:
        logger.error("Nessie API returned HTTP %s: %s", resp.status_code, exc)
        raise ValueError(
            f"Nessie API error {resp.status_code}: {resp.text}"
        ) from exc

    transactions: list[dict] = resp.json()
    logger.info("run_audit | fetched %d transaction(s)", len(transactions))

    if not transactions:
        raise ValueError(
            f"No transactions found for username '{username}'. Cannot run audit."
        )

    # ------------------------------------------------------------------
    # Step 2 — Build prompts
    # ------------------------------------------------------------------
    logger.info("run_audit | building prompts")
    system_prompt, user_prompt, schema = build_complete_audit_prompt(
        policy_text, transactions
    )
    logger.info(
        "run_audit | prompts ready | system_len=%d | user_len=%d",
        len(system_prompt),
        len(user_prompt),
    )

    # ------------------------------------------------------------------
    # Step 3 — Call the LLM
    # ------------------------------------------------------------------
    logger.info("run_audit | calling LLM")
    try:
        raw_response = call_llama(system_prompt, user_prompt, schema)
    except OllamaConnectionError as exc:
        logger.error("Ollama connection failed: %s", exc)
        raise ConnectionError(str(exc)) from exc
    except OllamaGenerationError as exc:
        logger.error("Ollama generation error: %s", exc)
        raise ValueError(f"LLM generation failed: {exc}") from exc

    logger.info("run_audit | LLM call complete")

    # ------------------------------------------------------------------
    # Step 4 — Validate response
    # ------------------------------------------------------------------
    logger.info("run_audit | validating LLM response")
    report = validate_llm_response(raw_response)
    logger.info(
        "run_audit | complete | results=%d | summary=%s",
        len(report.audit_results),
        report.summary[:80],
    )

    return report


# ---------------------------------------------------------------------------
# Example / quick self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from unittest.mock import MagicMock, patch

    logging.basicConfig(level=logging.INFO)

    mock_transactions = [
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
    ]

    mock_llm_response = {
        "audit_results": [
            {
                "transaction_id": "tx_001",
                "risk_level": "high",
                "finding": "Entertainment spend $750 exceeds $500 cap.",
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
        ],
        "summary": "1 high-risk transaction flagged.",
    }

    sample_policy = (
        "No entertainment expenses above $500. "
        "Travel above $200 requires prior approval."
    )

    mock_get = MagicMock()
    mock_get.return_value.json.return_value = mock_transactions
    mock_get.return_value.raise_for_status = MagicMock()
    mock_get.return_value.status_code = 200

    with (
        patch("audit_engine.requests.get", mock_get),
        patch("audit_engine.call_llama", return_value=mock_llm_response),
    ):
        report = run_audit(
            username="jdoe",
            policy_text=sample_policy,
            nessie_endpoint_url="http://localhost:8000/api/transactions",
        )

    print("Report summary:", report.summary)
    print("Results count:", len(report.audit_results))
    for r in report.audit_results:
        print(f"  [{r.risk_level.upper()}] {r.transaction_id}: {r.finding}")
