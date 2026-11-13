"""Typed MCP mappings and trusted review-context injection, without an LLM."""

import copy
import json

import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError


async def credential():
    return "fixture-only-not-live"


def configured():
    from app.market_mcp import MarketAnalystTools

    return MarketAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential)
    )


@pytest.mark.asyncio
async def test_employee_wrappers_preserve_exact_refs_and_canonical_structured_receipts(monkeypatch):
    from app import market_mcp

    tools, calls = configured(), []

    async def call(config, name, arguments, **options):
        assert config.endpoint == "https://operator.example/mcp"
        calls.append((name, arguments, options))
        return {
            "isError": False,
            "structuredContent": {"success": True, "analysis": {"fixture": name}},
            "content": [{"type": "text", "text": "duplicate body"}],
        }

    monkeypatch.setattr(market_mcp, "call_tool", call)
    cases = [
        (
            lambda: tools.analyze_market_conditions("Appalachia", "gas", "1year", ["prices"], 0.9),
            "analyze_market_conditions",
            {
                "region": "Appalachia",
                "commodity": "gas",
                "timeframe": "1year",
                "factors": ["prices"],
                "matchThreshold": 0.9,
            },
        ),
        (
            lambda: tools.competitive_market_analysis(
                ["Synthetic operator"], "Appalachia", ["production"], 0.9
            ),
            "competitive_analysis",
            {
                "competitors": ["Synthetic operator"],
                "market": "Appalachia",
                "metrics": ["production"],
                "matchThreshold": 0.9,
            },
        ),
        (
            lambda: tools.read_market_inputs("task.market", "r1"),
            "read_market_inputs",
            {"taskRef": {"id": "task.market", "revision": "r1"}},
        ),
        (
            lambda: tools.read_market_source("series", "s1", 2, 80),
            "read_market_source",
            {"sourceRef": {"id": "series", "revision": "s1"}, "offset": 2, "maxChars": 80},
        ),
        (
            lambda: tools.get_context_source_metadata("series", "s1", "export"),
            "get_context_source_metadata",
            {"sourceRef": {"id": "series", "revision": "s1"}, "operation": "export"},
        ),
        (
            lambda: tools.calculate_market_scenarios("task.market", "r1"),
            "calculate_market_scenarios",
            {"taskRef": {"id": "task.market", "revision": "r1"}},
        ),
        (
            lambda: tools.draft_market_scenario("task.market", "r1", '{"version":"0.1.0"}', "w2"),
            "draft_market_scenario",
            {
                "taskRef": {"id": "task.market", "revision": "r1"},
                "proposal": {"version": "0.1.0"},
                "revision": "w2",
            },
        ),
        (
            lambda: tools.prepare_market_review(
                '{"work":{},"market":{},"evaluations":[]}', "a" * 64
            ),
            "prepare_market_review",
            {"candidate": {"work": {}, "market": {}, "evaluations": []}, "expectedHead": "a" * 64},
        ),
        (
            lambda: tools.market_review_status("review.market"),
            "market_review_status",
            {"reviewId": "review.market"},
        ),
        (
            lambda: tools.record_market_scenarios("review.market", "a" * 64, "grant.exact"),
            "record_market_scenarios",
            {"reviewId": "review.market", "packetDigest": "a" * 64, "grantId": "grant.exact"},
        ),
    ]
    for run, name, arguments in cases:
        result = await run()
        assert result == {
            "isError": False,
            "structuredContent": {"success": True, "analysis": {"fixture": name}},
        }
        assert calls[-1] == (name, arguments, {})
    assert (await tools.market_review_status())["structuredContent"]["success"] is True
    assert calls[-1][1] == {}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad",
    ["[]", '{"x":1,"x":2}', '{"x":NaN}', '{"x":Infinity}', "true", "{", " " * 1_000_001],
    ids=["array", "duplicate", "nan", "infinity", "boolean", "malformed", "oversized"],
)
async def test_invalid_or_ambiguous_proposals_never_reach_the_mcp_client(monkeypatch, bad):
    from app import market_mcp

    tools = configured()

    async def unexpected(*args, **kwargs):
        raise AssertionError("Invalid JSON cannot dispatch a source or record call")

    monkeypatch.setattr(market_mcp, "call_tool", unexpected)
    for run in (
        lambda: tools.draft_market_scenario("task.market", "r1", bad),
        lambda: tools.prepare_market_review(bad),
    ):
        with pytest.raises(MCPClientError) as failure:
            await run()
        assert failure.value.code == "invalid_arguments"


@pytest.mark.asyncio
async def test_prepare_review_uses_current_host_context_and_rechecks_the_exact_backend_draft(
    monkeypatch,
):
    from app import market_mcp
    from app.market_mcp import MarketAnalystTools

    work = {
        "scope": {"taskId": "task.market"},
        "taskRevision": "r1",
        "artifact": {"revision": "w1"},
    }
    proposal = {"version": "0.1.0", "summary": "Agent interpretation only"}
    product = {"work": work, "market": {"proposal": proposal, "commercialAuthority": False}}
    manifest = {"fixture": "host-owned-exact-context"}
    calls, retained = [], []

    class Hooks:
        async def review_context(self, actual):
            assert actual == work
            return copy.deepcopy(manifest)

        async def record_review(self, receipt):
            retained.append(receipt)

    async def call(config, name, arguments, **options):
        calls.append((name, arguments))
        analysis = (
            product
            if name == "draft_market_scenario"
            else {"state": "awaiting-review", "reviewId": "review.market"}
        )
        return {
            "isError": False,
            "structuredContent": {"success": True, "analysis": copy.deepcopy(analysis)},
        }

    monkeypatch.setattr(market_mcp, "call_tool", call)
    tools = MarketAnalystTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential),
        context_hooks=Hooks(),
    )
    candidate = {**copy.deepcopy(product), "evaluations": []}
    await tools.prepare_market_review(json.dumps(candidate))
    assert calls[0] == (
        "draft_market_scenario",
        {
            "taskRef": {"id": "task.market", "revision": "r1"},
            "proposal": proposal,
            "revision": "w1",
        },
    )
    assert calls[-1][1]["candidate"]["context"] == manifest
    assert retained == [{"state": "awaiting-review", "reviewId": "review.market"}]
    candidate["context"] = {"fixture": "model-invented"}
    with pytest.raises(MCPClientError) as failure:
        await tools.prepare_market_review(json.dumps(candidate))
    assert failure.value.code == "context_binding_mismatch"
    assert len(retained) == 1
    candidate.pop("context")
    candidate["market"]["commercialAuthority"] = True
    with pytest.raises(MCPClientError) as failure:
        await tools.prepare_market_review(json.dumps(candidate))
    assert failure.value.code == "source_fidelity_mismatch"
    assert len(retained) == 1


@pytest.mark.asyncio
async def test_wire_failures_are_preserved_without_promoting_them_into_success(monkeypatch):
    from app import market_mcp

    tools = configured()
    failed = {"isError": True, "structuredContent": {"success": False, "code": "source_use_denied"}}

    async def call(*args, **kwargs):
        return failed

    monkeypatch.setattr(market_mcp, "call_tool", call)
    assert await tools.read_market_inputs("task.market", "r1") == failed
