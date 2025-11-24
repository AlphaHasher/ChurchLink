#tested 10 warnings, 9 errors on nov 22

"""
Test cases for Website Configuration API endpoints
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from mongo.database import DB
import asyncio

client = TestClient(app)

# Initialize the database connection for testing
asyncio.run(DB.init_db())

class TestWebsiteConfig:
    """Test website configuration endpoints"""
    
    def setup_method(self):
        """Clean up before each test"""
        # Clear the settings collection (where website config is stored)
        asyncio.run(DB.db.settings.delete_many({"key": {"$regex": "^website_"}}))
    
    def test_get_website_config_default(self):
        """Test getting default website configuration"""
        response = client.get("/api/v1/website/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "title" in data
        assert "favicon_url" in data
        assert data["title"] == "Your Church Website"
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
        
        assert response.status_code == 422  # Validation error from Pydantic
        error_detail = response.json()["detail"]
        assert any("cannot be empty" in str(error) for error in error_detail)
    
    def test_update_website_title_whitespace_only(self):
        """Test updating website title with whitespace only should fail"""
        update_data = {"title": "   "}
        response = client.put("/api/v1/website/title", json=update_data)
        
        assert response.status_code == 422  # Validation error from Pydantic
    
    def test_update_website_title_too_long(self):
        """Test updating website title that's too long should fail"""
        update_data = {"title": "A" * 61}  # More than 60 characters
        response = client.put("/api/v1/website/title", json=update_data)
        
        assert response.status_code == 422  # Validation error from Pydantic
    
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
        assert data["config"]["meta_description"] == "Welcome to our church website"
    
    def test_update_website_config_invalid_favicon_url(self):
        """Test updating website configuration with invalid favicon URL"""
        update_data = {
            "favicon_url": "invalid-url.txt"  # Invalid extension
        }
        
        response = client.put("/api/v1/website/config", json=update_data)
        assert response.status_code == 422  # Validation error
    
    def test_update_website_config_meta_description_too_long(self):
        """Test updating website configuration with meta description too long"""
        update_data = {
            "meta_description": "A" * 161  # More than 160 characters
        }
        
        response = client.put("/api/v1/website/config", json=update_data)
        assert response.status_code == 422  # Validation error
    
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
