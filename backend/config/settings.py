from pydantic_settings import BaseSettings
from pydantic import ConfigDict
import sys
import os
from dotenv import load_dotenv
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
env_path = Path("/strapi/churchlink/.env")
load_dotenv(dotenv_path=env_path)

class Settings(BaseSettings):
    """Application settings."""

    # Strapi API settings
    STRAPI_API_URL: str = os.getenv("STRAPI_API_URL", "http://localhost:1337")
    STRAPI_API_TOKEN: str = os.getenv("API_TOKEN_SALT", "")


    model_config = ConfigDict(
        env_file=str(env_path),
        case_sensitive=True
    )

# Create settings instance
settings = Settings()
