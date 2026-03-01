"""
routes.py — FastAPI router for the LLM audit engine.

Endpoints:
    POST /audit/run    — Run a full audit and return risk-level summary.
    GET  /audit/health — Health-check: confirm Ollama is reachable.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from audit_engine import run_audit
from data_validator import AuditResult, count_risk_levels
from ollama_client import check_ollama_running

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class AuditRunRequest(BaseModel):
    """Request body for POST /audit/run."""

    username: str
    policy_text: str
    nessie_endpoint_url: str


class AuditRunResponse(BaseModel):
    """Response body for POST /audit/run."""

    audit_results: list[AuditResult]
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    status: str = "success"


class HealthResponse(BaseModel):
    """Response body for GET /audit/health."""

    status: str
    model: str
    ollama_running: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/run", response_model=AuditRunResponse)
async def audit_run(request: AuditRunRequest) -> AuditRunResponse:
    """
    Run an LLM-powered financial audit.

    Fetches the user's transactions from the Nessie API, passes them to
    the local llama3 model with the provided spending policy, validates
    the output, and returns a risk-level breakdown.

    Args:
        request: AuditRunRequest containing username, policy_text, and
                 the Nessie endpoint URL.

    Returns:
        AuditRunResponse with audit results and risk-level counts.

    Raises:
        HTTPException 400: Missing or invalid input data.
        HTTPException 503: Ollama or Nessie service unavailable.
        HTTPException 500: Unexpected internal error.
    """
    logger.info(
        "POST /audit/run | username=%s | nessie_url=%s",
        request.username,
        request.nessie_endpoint_url,
    )

    try:
        report = run_audit(
            username=request.username,
            policy_text=request.policy_text,
            nessie_endpoint_url=request.nessie_endpoint_url,
        )
    except ValueError as exc:
        logger.warning("Audit input/validation error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ConnectionError as exc:
        logger.error("Service unreachable during audit: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during audit: %s", exc)
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc

    counts = count_risk_levels(report)

    return AuditRunResponse(
        audit_results=report.audit_results,
        high_risk_count=counts["high_risk_count"],
        medium_risk_count=counts["medium_risk_count"],
        low_risk_count=counts["low_risk_count"],
        status="success",
    )


@router.get("/health", response_model=HealthResponse)
async def audit_health() -> HealthResponse:
    """
    Health check for the audit service.

    Probes the local Ollama server to confirm it is reachable.

    Returns:
        HealthResponse with overall status, model name, and ollama_running flag.
    """
    model = "llama3"
    running = check_ollama_running(model=model)

    logger.info("GET /audit/health | ollama_running=%s", running)

    return HealthResponse(
        status="ok" if running else "degraded",
        model=model,
        ollama_running=running,
    )


# ---------------------------------------------------------------------------
# Example: mount router in a standalone FastAPI app (for local testing)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from fastapi import FastAPI

    app = FastAPI(title="SUSpend LLM Audit Engine")
    app.include_router(router)

    print("Starting development server on http://localhost:8001")
    print("Docs: http://localhost:8001/docs")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
