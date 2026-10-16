import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import init_db

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()

def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["free_tier_compliant"] is True
        assert data["gpu_required"] is False

def test_get_counters():
    with TestClient(app) as client:
        response = client.get("/api/counters")
        assert response.status_code == 200
        counters = response.json()
        assert len(counters) >= 3
        for c in counters:
            assert "polygon_coords" in c
            assert "name" in c

def test_analytics_summary():
    with TestClient(app) as client:
        response = client.get("/api/analytics/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total_waiting" in data
        assert "active_counters" in data
        assert "avg_wait_time_min" in data

def test_auth_dev_login():
    with TestClient(app) as client:
        response = client.post("/api/auth/dev-login", json={"name": "Test Manager"})
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["name"] == "Test Manager"
