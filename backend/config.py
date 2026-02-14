import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql://nightshade:nightshade@localhost:5432/nightshade"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    SOLANA_RPC_URL = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    PRESAGE_API_KEY = os.environ.get("PRESAGE_API_KEY", "")
    BACKBOARD_API_KEY = os.environ.get("BACKBOARD_API_KEY", "")
    ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
    TWELVELABS_API_KEY = os.environ.get("TWELVELABS_API_KEY", "")
