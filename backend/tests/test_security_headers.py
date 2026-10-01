def test_security_headers_present_on_every_response(client):
    response = client.get("/health")
    assert response.headers["strict-transport-security"] == "max-age=63072000; includeSubDomains"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"


def test_security_headers_present_on_error_responses(client):
    response = client.get("/api/v1/questions")
    assert response.status_code == 401
    assert response.headers["x-content-type-options"] == "nosniff"


def test_api_responses_are_not_cacheable(client):
    response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})
    assert response.headers["cache-control"] == "no-store"


def test_non_api_responses_keep_default_caching(client):
    assert "cache-control" not in client.get("/health").headers


def test_api_responses_forbid_loading_and_framing(client):
    response = client.get("/api/v1/questions")
    assert response.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"


def test_non_api_responses_have_no_csp(client):
    # /docs (dev only) runs Swagger UI's scripts; /health is no document either way.
    assert "content-security-policy" not in client.get("/health").headers
