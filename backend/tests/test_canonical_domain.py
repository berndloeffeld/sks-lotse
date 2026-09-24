import pytest


@pytest.mark.parametrize(
    ("host", "path", "location"),
    [
        ("sks-lotse.com", "/api/v1/questions", "https://sks-lotse.de/api/v1/questions"),
        (
            "www.sks-lotse.com",
            "/api/v1/questions?subject=navigation",
            "https://sks-lotse.de/api/v1/questions?subject=navigation",
        ),
    ],
)
def test_secondary_domain_redirects_to_canonical_keeping_path_and_query(client, host, path, location):
    response = client.get(path, headers={"host": host}, follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == location


@pytest.mark.parametrize(
    "host",
    [
        "sks-lotse.com",  # /health is never redirected, even on a secondary domain
        "www.sks-lotse.com",
        "sks-lotse.de",  # canonical
        "localhost:8000",  # unrelated
        "sks-lotse.global",  # registered, not wired up yet
        "sks-lotse.store",
    ],
)
def test_health_is_served_without_redirect(client, host):
    response = client.get("/health", headers={"host": host}, follow_redirects=False)
    assert response.status_code == 200
