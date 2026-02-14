from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import Config

db = SQLAlchemy()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://127.0.0.1:3000"])
    db.init_app(app)
    Migrate(app, db)

    from app import models  # noqa: F401 - register models for Alembic

    from app.routes import auth_bp, users_bp, bills_bp, transactions_bp, wallets_bp, cards_bp, documents_bp, assistant_bp, orderbook_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(wallets_bp, url_prefix="/api/wallets")
    app.register_blueprint(transactions_bp, url_prefix="/api/transactions")
    app.register_blueprint(bills_bp, url_prefix="/api/bills")
    app.register_blueprint(cards_bp, url_prefix="/api/cards")
    app.register_blueprint(documents_bp, url_prefix="/api/documents")
    app.register_blueprint(assistant_bp, url_prefix="/api/assistant")
    app.register_blueprint(orderbook_bp, url_prefix="/api/orderbook")

    return app
