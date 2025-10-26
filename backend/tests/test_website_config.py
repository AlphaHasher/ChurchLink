"""
Test cases for Website Configuration API endpoints
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from mongo.database import DB
import asyncio

client = TestClient(app)

class TestWebsiteConfig:
    """Test website configuration endpoints"""
    
    def setup_method(self):
        """Clean up before each test"""
        # Clear the website_config collection
        asyncio.run(DB.db.website_config.delete_many({}))
    
    def test_get_website_config_default(self):
        """Test getting default website configuration"""
        response = client.get("/api/v1/website/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "title" in data
        assert "favicon_url" in data
        assert data["title"] == "ChurchLink"
        assert data["favicon_url"] == "/dove-favicon.svg"
    
    def test_update_website_title(self):
        """Test updating website title"""
        # First, ensure we have a config
        client.get("/api/v1/website/config")
        
        # Update title
        update_data = {"title": "My New Church"}
        response = client.put("/api/v1/website/title", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "My New Church"
        assert data["message"] == "Website title updated successfully"
    
    def test_update_website_title_empty(self):
        """Test updating website title with empty string should fail"""
        update_data = {"title": ""}
        response = client.put("/api/v1/website/title", json=update_data)
        
        assert response.status_code == 400
        assert "cannot be empty" in response.json()["detail"]
    
    def test_update_website_config(self):
        """Test updating website configuration"""
        update_data = {
            "title": "Updated Church Name",
            "favicon_url": "/new-favicon.ico",
            "meta_description": "Welcome to our church website"
        }
        
        response = client.put("/api/v1/website/config", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["message"] == "Website configuration updated successfully"
        assert data["config"]["title"] == "Updated Church Name"
        assert data["config"]["favicon_url"] == "/new-favicon.ico"
    
    def test_get_admin_website_config(self):
        """Test getting admin website configuration with metadata"""
        # First create some config
        client.put("/api/v1/website/config", json={"title": "Test Church"})
        
        response = client.get("/api/v1/website/config/admin")
        assert response.status_code == 200
        
        data = response.json()
        assert "title" in data
        assert "updated_by" in data
        assert "updated_at" in data
        assert data["title"] == "Test Church"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
