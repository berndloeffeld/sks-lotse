def test_security_headers_present_on_every_response(client):
    response = client.get("/health")
    assert response.headers["strict-transport-security"] == "max-age=63072000; includeSubDomains"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_security_headers_present_on_error_responses(client):
    response = client.get("/api/v1/questions/999999")
    assert response.status_code == 401
    assert response.headers["x-content-type-options"] == "nosniff"
