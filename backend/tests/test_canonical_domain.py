def test_secondary_domain_redirects_to_canonical(client):
    response = client.get(
        "/health",
        headers={"host": "sks-lotse.com"},
        follow_redirects=False,
    )
    assert response.status_code == 301
    assert response.headers["location"] == "https://sks-lotse.de/health"


def test_secondary_domain_with_query_preserves_it(client):
    response = client.get(
        "/api/v1/questions?subject=navigation",
        headers={"host": "www.sks-lotse.com"},
        follow_redirects=False,
    )
    assert response.status_code == 301
    assert response.headers["location"] == "https://sks-lotse.de/api/v1/questions?subject=navigation"


def test_canonical_domain_not_redirected(client):
    response = client.get("/health", headers={"host": "sks-lotse.de"})
    assert response.status_code == 200


def test_unrelated_host_not_redirected(client):
    response = client.get("/health", headers={"host": "localhost:8000"})
    assert response.status_code == 200


def test_not_yet_wired_domains_not_redirected(client):
    for host in ("sks-lotse.global", "sks-lotse.store"):
        response = client.get("/health", headers={"host": host})
        assert response.status_code == 200
