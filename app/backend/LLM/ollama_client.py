"""
ollama_client.py — HTTP client for the local Ollama inference server.

Provides:
- OllamaClient: low-level class for generate/chat calls.
- call_llama(): high-level function used by audit_engine.
- check_ollama_running(): health-check probe used by the /audit/health route.
"""

import json
import logging
import time
from typing import Any, Generator

import requests

logger = logging.getLogger(__name__)

DEFAULT_HOST = "localhost"
DEFAULT_PORT = 11434


class OllamaConnectionError(Exception):
    """Raised when the Ollama server is unreachable."""


class OllamaGenerationError(Exception):
    """Raised when the Ollama API returns a non-2xx response."""


class OllamaClient:
    """Low-level HTTP wrapper around the Ollama REST API."""

    def __init__(
        self,
        model: str = "llama3",
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        timeout: int = 120,
    ):
        """
        Initialise the client.

        Args:
            model:   Ollama model tag to use by default.
            host:    Hostname of the Ollama server.
            port:    Port of the Ollama server.
            timeout: Request timeout in seconds.
        """
        self.model = model
        self.base_url = f"http://{host}:{port}"
        self.timeout = timeout

    def _build_options(self, kwargs: dict) -> dict:
        allowed = {"temperature", "top_p", "top_k", "num_ctx", "num_predict", "stop"}
        return {k: v for k, v in kwargs.items() if k in allowed}

    def generate(
        self,
        prompt: str,
        system: str | None = None,
        stream: bool = False,
        **kwargs,
    ) -> str | Generator[str, None, None]:
        """
        Call /api/generate (single-turn completion).

        Args:
            prompt: The user prompt string.
            system: Optional system prompt.
            stream: Whether to stream the response token-by-token.
            **kwargs: Model options (temperature, top_p, etc.)

        Returns:
            Complete response string, or a generator if stream=True.
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": stream,
            "options": self._build_options(kwargs),
        }
        if system:
            payload["system"] = system

        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                stream=stream,
                timeout=self.timeout,
            )
        except requests.exceptions.ConnectionError as e:
            raise OllamaConnectionError(f"Cannot connect to Ollama at {self.base_url}") from e

        if not response.ok:
            raise OllamaGenerationError(f"Ollama API error {response.status_code}: {response.text}")

        if stream:
            return self._stream_generate(response)

        return response.json().get("response", "")

    def _stream_generate(self, response: requests.Response) -> Generator[str, None, None]:
        for line in response.iter_lines():
            if line:
                chunk = json.loads(line)
                yield chunk.get("response", "")
                if chunk.get("done"):
                    break

    def chat(
        self,
        messages: list[dict],
        system: str | None = None,
        stream: bool = False,
        format: dict | str | None = None,
        **kwargs,
    ) -> str | Generator[str, None, None]:
        """
        Call /api/chat (multi-turn chat completion).

        Args:
            messages: List of {"role": ..., "content": ...} dicts.
            system:   Optional system prompt prepended to messages.
            stream:   Whether to stream the response.
            format:   JSON Schema dict (or "json") to constrain the output.
                      Pass a schema dict to get structured JSON back.
            **kwargs: Model options (temperature, top_p, etc.)

        Returns:
            Complete response string, or a generator if stream=True.
        """
        if system:
            messages = [{"role": "system", "content": system}] + list(messages)

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
            "options": self._build_options(kwargs),
        }
        if format is not None:
            payload["format"] = format

        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                stream=stream,
                timeout=self.timeout,
            )
        except requests.exceptions.ConnectionError as e:
            raise OllamaConnectionError(f"Cannot connect to Ollama at {self.base_url}") from e

        if not response.ok:
            raise OllamaGenerationError(f"Ollama API error {response.status_code}: {response.text}")

        if stream:
            return self._stream_chat(response)

        return response.json().get("message", {}).get("content", "")

    def _stream_chat(self, response: requests.Response) -> Generator[str, None, None]:
        for line in response.iter_lines():
            if line:
                chunk = json.loads(line)
                yield chunk.get("message", {}).get("content", "")
                if chunk.get("done"):
                    break

    def is_available(self) -> bool:
        """Return True if Ollama is reachable, False otherwise."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.ok
        except requests.exceptions.ConnectionError:
            return False


# ---------------------------------------------------------------------------
# Module-level convenience functions (used by audit_engine and routes)
# ---------------------------------------------------------------------------

# Singleton client used by call_llama / check_ollama_running
_client = OllamaClient()


def call_llama(
    system_prompt: str,
    user_prompt: str,
    schema: dict[str, Any],
    model: str = "llama3",
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Send a structured audit prompt to the local llama3 model.

    Enforces deterministic, JSON-schema-constrained output via Ollama's
    ``format`` parameter. Logs model, input lengths, and elapsed time.

    Args:
        system_prompt: System-role message (auditor persona + policy).
        user_prompt:   User-role message (transaction data).
        schema:        JSON Schema dict constraining the LLM output format.
        model:         Ollama model tag (default: 'llama3').
        **kwargs:      Optional model options (e.g. num_predict for longer output).

    Returns:
        Parsed dict from the model's JSON response.

    Raises:
        OllamaConnectionError: If Ollama is not running or unreachable.
        OllamaGenerationError: If Ollama returns a non-2xx response.
        ValueError:            If the model returns unparseable content.
    """
    client = OllamaClient(model=model)

    logger.info(
        "call_llama | model=%s | system_len=%d | user_len=%d",
        model,
        len(system_prompt),
        len(user_prompt),
    )

    start = time.perf_counter()
    content = client.chat(
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
        format=schema,
        temperature=0,
        **kwargs,
    )
    elapsed = time.perf_counter() - start

    logger.info(
        "call_llama complete | output_len=%d | elapsed=%.2fs",
        len(content),
        elapsed,
    )

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error("Model returned non-JSON content: %.200s", content)
        raise ValueError(
            f"Model response is not valid JSON: {exc}\nContent: {content[:200]}"
        ) from exc


def check_ollama_running(model: str = "llama3") -> bool:
    """
    Probe the Ollama server to confirm it is running.

    Args:
        model: Model name to include in the health log (not validated here).

    Returns:
        True if Ollama responds successfully, False otherwise.
    """
    available = _client.is_available()
    logger.debug("check_ollama_running | available=%s | model=%s", available, model)
    return available


# ---------------------------------------------------------------------------
# Example / quick self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    print("Checking if Ollama is running...")
    if not check_ollama_running():
        print("Ollama is NOT running — start it with: ollama serve")
    else:
        from prompt import build_complete_audit_prompt

        sample_policy = (
            "No entertainment expenses above $500. "
            "Travel above $200 requires prior approval."
        )
        sample_transactions = [
            {
                "transaction_id": "tx_001",
                "amount": 750,
                "merchant": "Sky Lounge",
                "category": "Entertainment",
                "date": "2025-02-15",
            }
        ]

        sys_p, usr_p, schema = build_complete_audit_prompt(
            sample_policy, sample_transactions
        )
        result = call_llama(sys_p, usr_p, schema)
        print("LLM result:", json.dumps(result, indent=2))
