"""Which site a request comes from (app/core/site.py, ADR-0070)."""

import pytest
from starlette.requests import Request

from app.core import site as sites
from app.core.config import settings


def _request(headers: dict[str, str]) -> Request:
    raw = [(name.lower().encode(), value.encode()) for name, value in headers.items()]
    return Request({"type": "http", "headers": raw})


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ({"Origin": "http://localhost:5173"}, "sks"),
        ({"Origin": "http://127.0.0.1:5173"}, "sks"),
        ({"Origin": "http://localhost:5174"}, "sbf"),
        ({"Origin": "http://127.0.0.1:4174"}, "sbf"),
        # The allowlisted Origin wins over the host it was sent to.
        ({"Origin": "http://localhost:5173", "Host": "api.sbf-lotse.de"}, "sks"),
        ({"Origin": "http://localhost:5174", "Host": "api.sks-lotse.de"}, "sbf"),
        # No Origin (Postman, curl): the API host decides.
        ({"Host": "api.sbf-lotse.de"}, "sbf"),
        ({"Host": "API.SBF-LOTSE.DE:443"}, "sbf"),
        ({"Host": "api.sks-lotse.de"}, "sks"),
        ({}, "sks"),
        # An Origin outside the allowlist counts for nothing, the host still does.
        ({"Origin": "https://evil.example", "Host": "api.sbf-lotse.de"}, "sbf"),
        ({"Origin": "https://evil.example"}, "sks"),
        ({"Origin": "null"}, "sks"),
    ],
)
def test_resolve_site(headers, expected):
    assert sites.resolve_site(_request(headers)) == expected


def test_production_origins_resolve_to_their_site(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    assert sites.resolve_site(_request({"Origin": "https://sbf-lotse.de"})) == "sbf"
    assert sites.resolve_site(_request({"Origin": "https://www.sbf-lotse.de"})) == "sbf"
    assert sites.resolve_site(_request({"Origin": "https://sks-lotse.de"})) == "sks"
    # A dev origin means nothing in production.
    assert sites.resolve_site(_request({"Origin": "http://localhost:5174"})) == "sks"


def test_base_url_is_each_sites_first_origin(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    assert sites.base_url("sks") == "https://sks-lotse.de"
    assert sites.base_url("sbf") == "https://sbf-lotse.de"


def test_from_address_per_site(monkeypatch):
    monkeypatch.setattr(settings, "email_from_address", "A <a@sks-lotse.de>")
    monkeypatch.setattr(settings, "email_from_address_sbf", "B <b@sbf-lotse.de>")
    assert sites.from_address("sks") == "A <a@sks-lotse.de>"
    assert sites.from_address("sbf") == "B <b@sbf-lotse.de>"


@pytest.mark.parametrize(
    ("value", "expected"), [("sks", "sks"), ("sbf", "sbf"), (None, "sks"), ("", "sks"), ("SBF", "sks")]
)
def test_as_site_falls_back_to_sks_lotse(value, expected):
    assert sites.as_site(value) == expected


def test_every_site_has_a_brand():
    assert set(sites.BRANDS) == set(sites.SITES) == set(settings.site_origins)
    assert sites.BRANDS["sks"].name == "SKS Lotse"
    assert sites.BRANDS["sbf"].name == "SBF Lotse"
