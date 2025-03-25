from pydantic import BaseSettings
import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path("/strapi/churchlink/.env")
load_dotenv(dotenv_path=env_path)

class Settings(BaseSettings):
    """Application settings."""

    # Strapi API settings
    STRAPI_API_URL: str = os.getenv("STRAPI_API_URL", "http://localhost:1337")
    STRAPI_API_TOKEN: str = os.getenv("API_TOKEN_SALT", "")


    class Config:
        env_file = str(env_path)
        case_sensitive = True

# Create settings instance
settings = Settings()
