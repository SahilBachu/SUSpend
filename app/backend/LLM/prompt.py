"""
Prompt Engineering Module for Financial Audit LLM

Builds system and user prompts for Llama3 to perform deterministic 
audit analysis on transactions against company policy.
"""

import json
from typing import List, Dict, Any


# JSON Schema for LLM output — matches data_validator.AuditReport
AUDIT_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "audit_results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "transaction_id": {"type": "string"},
                    "type": {"type": "string"},
                    "risk_level": {"type": "string", "enum": ["high", "medium", "low"]},
                    "category": {"type": "string"},
                    "over_budget_amount": {"type": "number"},
                    "finding": {"type": "string"},
                    "policy_violation": {"type": "string"},
                    "recommendation": {"type": "string"},
                },
                "required": [
                    "transaction_id",
                    "type",
                    "risk_level",
                    "category",
                    "over_budget_amount",
                    "finding",
                    "policy_violation",
                    "recommendation",
                ],
            },
        },
        "summary": {"type": "string"},
    },
    "required": ["audit_results", "summary"],
}


def build_system_prompt() -> str:
    """
    Build the system prompt that defines the LLM's role and constraints.
    
    This is the "Golden Prompt" - it forces the model to behave like
    a data processor, not a conversationalist.
    
    Returns:
        str: System prompt for Ollama
    """
    system_prompt = """You are a B2B Privacy-First AI Auditor. Your role is to perform a strict compliance check on employee expenses.

CONTEXT:
You will be provided with a plain-English corporate expense policy.
You will receive a list of transactions in JSON format from the Capital One Nessie API.

TASK:
For each transaction, evaluate if it violates the policy.
Assign risk_level: "high" if it is a clear violation, "medium" if it is suspicious or lacks documentation, "low" if it is compliant.

OUTPUT REQUIREMENTS:
You must output a JSON object with:
- "audit_results": array of objects, one per transaction. Each object must have:
  - "transaction_id": the transaction's id from the input
  - "type": the transaction's type from the input
  - "risk_level": exactly "high", "medium", or "low" (lowercase)
  - "category": expense category label inferred from transaction/policy (e.g., "Meals & Dining", "Travel")
  - "over_budget_amount": numeric amount above policy cap for this transaction; use 0 if compliant or no explicit cap applies
  - "finding": one-sentence description of the issue or compliance
  - "policy_violation": the policy rule violated, or "none" if compliant
  - "recommendation": suggested action
- "summary": one-sentence summary of the audit

CONSTRAINTS:
- Do not add any text before or after the JSON.
- Do not explain yourself in the output.
- Use only the data provided in the transactions.
- Return ONLY valid JSON. No conversational filler. No markdown code blocks.
- risk_level must be exactly: "high", "medium", or "low" (lowercase)."""
    
    return system_prompt


def _normalize_transaction(tx: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure transaction has transaction_id for LLM output consistency."""
    out = dict(tx)
    if "transaction_id" not in out:
        if "purchase_id" in out:
            out["transaction_id"] = out["purchase_id"]
        elif "_id" in out:
            out["transaction_id"] = out["_id"]
    return out


def build_user_prompt(policy_text: str, transactions: List[Dict[str, Any]]) -> str:
    """
    Build the user prompt that contains the policy and transaction data.

    Args:
        policy_text (str): Plain-English expense policy
        transactions (List[Dict]): List of transaction objects from Nessie API

    Returns:
        str: User prompt for Ollama
    """
    # Normalize so each tx has transaction_id for consistent LLM output
    normalized = [_normalize_transaction(tx) for tx in transactions]
    transactions_json = json.dumps(normalized, indent=2)
    
    user_prompt = f"""CORPORATE EXPENSE POLICY:
{policy_text}

TRANSACTIONS TO AUDIT:
{transactions_json}

Analyze each transaction against the policy above and return the audit results."""
    
    return user_prompt


def build_fraud_detection_prompt(policy_text: str, transactions: List[Dict[str, Any]]) -> str:
    """
    Alternative prompt with enhanced fraud detection focus.
    
    Emphasizes pattern detection for:
    - Smurfing (structuring to avoid thresholds)
    - Mischaracterization (wrong category)
    - Duplicates (near-identical transactions)
    - Unusual patterns
    
    Args:
        policy_text (str): Expense policy
        transactions (List[Dict]): Transaction data
        
    Returns:
        str: Enhanced user prompt focused on fraud
    """
    
    normalized = [_normalize_transaction(tx) for tx in transactions]
    transactions_json = json.dumps(normalized, indent=2)

    user_prompt = f"""CORPORATE EXPENSE POLICY:
{policy_text}

TRANSACTIONS TO AUDIT:
{transactions_json}

SPECIAL ATTENTION TO:
- Smurfing: Multiple purchases just under policy thresholds (e.g., all $49.99 when receipt required at $50)
- Mischaracterization: Items coded to wrong expense category (e.g., personal shopping as "meals")
- Duplicates: Same merchant, similar amounts, suspicious timing patterns
- Unusual Patterns: Transactions inconsistent with employee role, location, or business context

Analyze each transaction and flag suspicious patterns. Return the audit results."""
    
    return user_prompt




def format_policy_summary(policy_text: str, max_length: int = 1000) -> str:
    """
    Truncate policy to fit in context window if needed.
    
    Llama3 has 8k context window. Keep policy concise.
    
    Args:
        policy_text (str): Full policy text
        max_length (int): Maximum characters to keep
        
    Returns:
        str: Truncated policy
    """
    if len(policy_text) > max_length:
        return policy_text[:max_length] + "\n... [policy truncated]"
    return policy_text


def validate_prompt_format(policy_text: str, transactions: List[Dict[str, Any]]) -> bool:
    """
    Quick validation that prompts will be well-formed.
    
    Args:
        policy_text (str): Policy text
        transactions (List[Dict]): Transaction list
        
    Returns:
        bool: True if valid, False otherwise
    """
    
    if not policy_text or len(policy_text.strip()) == 0:
        print("ERROR: Policy text is empty")
        return False
    
    if not isinstance(transactions, list) or len(transactions) == 0:
        print("ERROR: Transactions must be non-empty list")
        return False
    
    # Check transaction structure (accept transaction_id or purchase_id for id field)
    for tx in transactions:
        if not isinstance(tx, dict):
            print("ERROR: Each transaction must be a dict")
            return False
        if "amount" not in tx:
            print("ERROR: Transactions must have amount")
            return False
        if "transaction_id" not in tx and "purchase_id" not in tx and "_id" not in tx:
            print("ERROR: Transactions must have transaction_id, purchase_id, or _id")
            return False

    return True


def build_complete_audit_prompt(
    policy_text: str,
    transactions: List[Dict[str, Any]],
    fraud_focus: bool = False,
) -> tuple[str, str, dict]:
    """
    Build system prompt, user prompt, and JSON schema for the audit LLM.

    Args:
        policy_text (str): Expense policy
        transactions (List[Dict]): Transaction data
        fraud_focus (bool): If True, emphasize fraud detection patterns

    Returns:
        tuple: (system_prompt, user_prompt, schema) — schema for Ollama format param
    """
    # Validate input
    if not validate_prompt_format(policy_text, transactions):
        raise ValueError("Invalid policy or transactions format")

    # Truncate policy if too long
    policy_text = format_policy_summary(policy_text, max_length=1500)

    # Build prompts
    system_prompt = build_system_prompt()

    if fraud_focus:
        user_prompt = build_fraud_detection_prompt(policy_text, transactions)
    else:
        user_prompt = build_user_prompt(policy_text, transactions)

    return system_prompt, user_prompt, AUDIT_RESPONSE_SCHEMA


# ---------------------------------------------------------------------------
# Email generation prompt (uses audit response from POST /audit/run)
# ---------------------------------------------------------------------------

EMAIL_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "email_subject": {"type": "string"},
        "email_body": {"type": "string"},
    },
    "required": ["email_subject", "email_body"],
}


def build_email_system_prompt() -> str:
    """System prompt for generating an audit summary email to the employee."""
    return """You are a professional corporate compliance officer writing an email to an employee about their expense audit results.

TASK:
Write a clear, professional email that:
1. Greets the employee by name.
2. Summarizes their transactions and the audit outcome.
3. Lists SUSPICIOUS transactions (high or medium risk) with brief explanations of what was flagged and why.
4. Lists VALID transactions (low risk) with brief confirmations.
5. Ends with next steps or a call to action if there are issues, or a simple closing if all is clear.

TONE: Professional, respectful, and direct. Not accusatory. Help the employee understand what was found.

CRITICAL: The email_body field MUST be a complete, multi-paragraph email. It must NOT be empty. Write at least 2-3 paragraphs covering the audit summary, flagged items, and next steps.

OUTPUT: Return a JSON object with exactly:
- "email_subject": A short, professional subject line (e.g. "Expense Audit Results - Action Required" or "Expense Audit Summary").
- "email_body": The full email body as plain text. Use line breaks (\\n) for readability. No HTML. Must be substantial (multiple paragraphs)."""


def build_email_user_prompt(
    employee_name: str,
    audit_results: list[dict],
    summary: str,
) -> str:
    """
    Build the user prompt for email generation from the audit response.

    Args:
        employee_name: Name of the employee (for salutation).
        audit_results: Array from audit endpoint (transaction_id, risk_level, finding, policy_violation, recommendation).
        summary: Audit summary string from audit endpoint.

    Returns:
        User prompt for Ollama.
    """
    audit_json = json.dumps(audit_results, indent=2)
    return f"""AUDIT SUMMARY:
{summary}

AUDIT RESULTS (each transaction with risk level and finding):
{audit_json}

Generate an email to {employee_name} summarizing these audit results. Separate suspicious (high/medium risk) from valid (low risk) transactions and explain each clearly. The email_body must be a complete multi-paragraph email (at least 2-3 paragraphs)—do NOT leave it empty. Return only valid JSON with email_subject and email_body."""
