"""
data_validator.py — Pydantic models and validation helpers for LLM audit output.

Responsibilities:
- Define the AuditResult and AuditReport Pydantic models.
- Validate raw LLM JSON responses into strongly-typed objects.
- Count transactions by risk level for the API response summary.
"""

import json
import logging
from typing import Any

from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AuditResult(BaseModel):
    """A single transaction's audit finding."""

    transaction_id: str
    risk_level: str = Field(..., pattern=r"^(high|medium|low)$")
    finding: str
    policy_violation: str
    recommendation: str

    @field_validator("risk_level")
    @classmethod
    def normalise_risk_level(cls, v: str) -> str:
        """Normalise risk level to lowercase for consistency."""
        return v.lower().strip()


class AuditReport(BaseModel):
    """Full audit report returned by the LLM and surfaced through the API."""

    audit_results: list[AuditResult]
    summary: str

    @field_validator("audit_results")
    @classmethod
    def results_not_empty(cls, v: list[AuditResult]) -> list[AuditResult]:
        """Require at least one result in the report."""
        if not v:
            raise ValueError("audit_results must contain at least one entry.")
        return v


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def validate_llm_response(raw: str | dict[str, Any]) -> AuditReport:
    """
    Parse and validate the raw LLM response into an AuditReport.

    Accepts either:
    - A JSON string (as returned by ollama_client.call_llama).
    - A pre-parsed dict (useful for testing).

    Args:
        raw: The LLM output — either a JSON string or a Python dict.

    Returns:
        A validated AuditReport Pydantic model.

    Raises:
        ValueError: If the response cannot be parsed or fails schema validation.
    """
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.error("LLM response is not valid JSON: %s", exc)
            raise ValueError(f"LLM response is not valid JSON: {exc}") from exc
    else:
        data = raw

    try:
        report = AuditReport.model_validate(data)
    except Exception as exc:
        logger.error("LLM response failed schema validation: %s", exc)
        raise ValueError(f"LLM response failed schema validation: {exc}") from exc

    logger.info(
        "Validated AuditReport — %d result(s), risk breakdown: %s",
        len(report.audit_results),
        count_risk_levels(report),
    )
    return report


def count_risk_levels(report: AuditReport) -> dict[str, int]:
    """
    Count audit results by risk level.

    Args:
        report: A validated AuditReport.

    Returns:
        Dict with keys 'high_risk_count', 'medium_risk_count', 'low_risk_count'.
    """
    counts = {"high_risk_count": 0, "medium_risk_count": 0, "low_risk_count": 0}
    for result in report.audit_results:
        key = f"{result.risk_level}_risk_count"
        if key in counts:
            counts[key] += 1
    return counts


# ---------------------------------------------------------------------------
# Example / quick self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    sample_llm_output = json.dumps(
        {
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
            ],
            "summary": "1 high-risk transaction flagged for policy violation.",
        }
    )

    report = validate_llm_response(sample_llm_output)
    counts = count_risk_levels(report)

    print("AuditReport summary:", report.summary)
    print("Risk counts:", counts)
    print("First result:", report.audit_results[0].model_dump())
