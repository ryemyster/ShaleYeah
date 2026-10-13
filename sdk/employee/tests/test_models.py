"""Each role keeps explicit providers and separate synthesis/judge credentials."""

import copy

import pytest

from shaleyeah_employee.models import ModelProviderError, parse_reference_config, public_profile


def configuration(provider="gemini"):
    owner = {"customerId": "operator-demo", "employeeId": "reporter"}

    def profile(purpose):
        return {
            "version": "0.1.0",
            "id": "reporter-" + purpose,
            "revision": "r1",
            "purpose": purpose,
            "owner": owner,
            "provider": provider,
            "model": "gemini-fixture-001" if provider == "gemini" else "claude-fixture-001",
            "modelRevision": "fixture-001",
            "endpoint": "https://generativelanguage.googleapis.com"
            if provider == "gemini"
            else "https://api.anthropic.com",
            "credentialRef": "secret:reporter-" + purpose,
            "capabilities": {"toolUse": True, "structuredOutput": True},
            "limits": {
                "timeoutMs": 30000,
                "maxAttempts": 1,
                "maxOutputTokens": 512,
                "maxRequests": 4,
                "maxInputChars": 262144,
            },
        }

    return {
        "version": "0.1.0",
        "agent": profile("agent"),
        "synthesis": profile("synthesis"),
        "judge": profile("judge"),
    }


@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
def test_explicit_role_profiles_are_preserved_without_secret_reference_disclosure(provider):
    raw = configuration(provider)
    before = copy.deepcopy(raw)
    parsed = parse_reference_config(raw)
    assert parsed.agent["owner"]["employeeId"] == "reporter"
    assert parsed.agent["provider"] == provider and parsed.synthesis["provider"] == provider
    assert raw == before
    assert "credentialRef" not in public_profile(parsed.agent)
    assert "secret:reporter-" not in repr(parsed)


def test_judge_cannot_reuse_the_employee_credential():
    raw = configuration()
    raw["judge"]["credentialRef"] = raw["agent"]["credentialRef"]
    with pytest.raises(ModelProviderError, match="judge"):
        parse_reference_config(raw)


def test_cross_employee_synthesis_profile_is_rejected():
    raw = configuration()
    raw["synthesis"]["owner"] = {"customerId": "operator-demo", "employeeId": "other"}
    with pytest.raises(ModelProviderError):
        parse_reference_config(raw)
