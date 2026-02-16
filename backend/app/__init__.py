import os
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import Config

db = SQLAlchemy()

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    origins = list(CORS_ORIGINS)
    frontend_origin = os.environ.get("FRONTEND_ORIGIN", "").strip()
    if frontend_origin and frontend_origin not in origins:
        origins.append(frontend_origin)
    CORS(app, supports_credentials=True, origins=origins)
    db.init_app(app)
    Migrate(app, db)

    from app import models  # noqa: F401 - register models for Alembic

    from app.routes import auth_bp, users_bp, bills_bp, transactions_bp, wallets_bp, cards_bp, documents_bp, assistant_bp, orderbook_bp, goals_bp, dashboard_bp, insights_bp, whatif_bp, optimizer_bp, portfolio_bp, experiences_bp
    from app.routes.notifications import notifications_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(insights_bp, url_prefix="/api/insights")
    app.register_blueprint(experiences_bp, url_prefix="/api/experiences")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(goals_bp, url_prefix="/api/goals")
    app.register_blueprint(wallets_bp, url_prefix="/api/wallets")
    app.register_blueprint(transactions_bp, url_prefix="/api/transactions")
    app.register_blueprint(bills_bp, url_prefix="/api/bills")
    app.register_blueprint(cards_bp, url_prefix="/api/cards")
    app.register_blueprint(documents_bp, url_prefix="/api/documents")
    app.register_blueprint(assistant_bp, url_prefix="/api/assistant")
    app.register_blueprint(orderbook_bp, url_prefix="/api/orderbook")
    app.register_blueprint(portfolio_bp, url_prefix="/api/portfolio")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(whatif_bp, url_prefix="/api/whatif")
    app.register_blueprint(optimizer_bp, url_prefix="/api/optimizer")

    return app
