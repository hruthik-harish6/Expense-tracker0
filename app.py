import csv
import io
import os
import secrets
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from functools import wraps

from flask import Flask, jsonify, redirect, render_template, request, session, url_for, make_response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, func
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

db = SQLAlchemy()

CATEGORIES = [
    "Food & Dining", "Transport", "Shopping", "Bills & Utilities", "Entertainment",
    "Health", "Education", "Travel", "Subscriptions", "Salary", "Freelance", "Other"
]

app = Flask(__name__, instance_relative_config=True)
os.makedirs(app.instance_path, exist_ok=True)
app.config.update(
    SECRET_KEY=os.getenv("SECRET_KEY", "dev-secret-change-me"),
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL", "sqlite:///cashflow.db"),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)
if app.config["SQLALCHEMY_DATABASE_URI"].startswith("postgres://"):
    app.config["SQLALCHEMY_DATABASE_URI"] = app.config["SQLALCHEMY_DATABASE_URI"].replace("postgres://", "postgresql+psycopg://", 1)
elif app.config["SQLALCHEMY_DATABASE_URI"].startswith("postgresql://"):
    app.config["SQLALCHEMY_DATABASE_URI"] = app.config["SQLALCHEMY_DATABASE_URI"].replace("postgresql://", "postgresql+psycopg://", 1)

db.init_app(app)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(90), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    currency = db.Column(db.String(8), nullable=False, default="INR")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    transactions = db.relationship("Transaction", backref="user", lazy=True, cascade="all, delete-orphan")
    budgets = db.relationship("Budget", backref="user", lazy=True, cascade="all, delete-orphan")


class Transaction(db.Model):
    __tablename__ = "transactions"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    kind = db.Column(db.String(12), nullable=False)  # income / expense
    amount = db.Column(db.Numeric(14, 2), nullable=False)
    category = db.Column(db.String(60), nullable=False)
    note = db.Column(db.String(280), nullable=True, default="")
    date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (CheckConstraint("amount > 0", name="ck_transaction_positive"),)


class Budget(db.Model):
    __tablename__ = "budgets"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    category = db.Column(db.String(60), nullable=False)
    amount = db.Column(db.Numeric(14, 2), nullable=False)
    month = db.Column(db.String(7), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (CheckConstraint("amount > 0", name="ck_budget_positive"),)


with app.app_context():
    db.create_all()


def current_user():
    uid = session.get("user_id")
    return db.session.get(User, uid) if uid else None


def csrf_token():
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return token


def csrf_ok():
    expected = session.get("csrf_token")
    provided = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token")
    return bool(expected and provided and secrets.compare_digest(expected, provided))


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user():
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("home"))
        return view(*args, **kwargs)
    return wrapped


def json_error(message, status=400):
    return jsonify({"error": message}), status


def parse_amount(value):
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
        if amount <= 0:
            raise InvalidOperation
        return amount
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("Enter a valid amount greater than 0")


def parse_date(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise ValueError("Enter a valid date")


def month_range(month):
    try:
        start = datetime.strptime(month + "-01", "%Y-%m-%d").date()
    except ValueError:
        start = date.today().replace(day=1)
    if start.month == 12:
        end = date(start.year + 1, 1, 1)
    else:
        end = date(start.year, start.month + 1, 1)
    return start, end


def tx_dict(tx, currency="INR"):
    return {
        "id": tx.id, "kind": tx.kind, "amount": float(tx.amount), "category": tx.category,
        "note": tx.note or "", "date": tx.date.isoformat(), "currency": currency
    }


def user_json(user):
    return {"id": user.id, "name": user.name, "email": user.email, "currency": user.currency}


@app.context_processor
def inject_globals():
    return {"csrf": csrf_token(), "user": current_user(), "categories": CATEGORIES}


@app.get("/")
def home():
    return render_template("auth.html") if not current_user() else redirect(url_for("app_shell"))


@app.get("/app")
@login_required
def app_shell():
    return render_template("app.html")


@app.post("/api/register")
def register():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not name or len(name) < 2:
        return json_error("Enter your full name.")
    if "@" not in email or len(email) < 5:
        return json_error("Enter a valid email address.")
    if len(password) < 8:
        return json_error("Password must be at least 8 characters.")
    if User.query.filter_by(email=email).first():
        return json_error("An account with this email already exists.", 409)
    user = User(name=name[:90], email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    session.clear()
    session["user_id"] = user.id
    session["csrf_token"] = secrets.token_urlsafe(32)
    return jsonify({"ok": True, "user": user_json(user)})


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return json_error("Email or password is incorrect.", 401)
    session.clear()
    session["user_id"] = user.id
    session["csrf_token"] = secrets.token_urlsafe(32)
    return jsonify({"ok": True, "user": user_json(user)})


@app.post("/api/logout")
@login_required
def logout():
    if not csrf_ok():
        return json_error("Invalid security token.", 403)
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
@login_required
def me():
    return jsonify({"user": user_json(current_user()), "csrf": csrf_token()})


@app.get("/api/summary")
@login_required
def summary():
    user = current_user()
    month = request.args.get("month", date.today().strftime("%Y-%m"))
    start, end = month_range(month)
    q = Transaction.query.filter(Transaction.user_id == user.id, Transaction.date >= start, Transaction.date < end)
    income = q.filter(Transaction.kind == "income").with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0
    expense = q.filter(Transaction.kind == "expense").with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0
    all_q = Transaction.query.filter_by(user_id=user.id)
    total_income = all_q.filter(Transaction.kind == "income").with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0
    total_expense = all_q.filter(Transaction.kind == "expense").with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0
    recent = q.order_by(Transaction.date.desc(), Transaction.created_at.desc()).limit(8).all()
    category_rows = db.session.query(Transaction.category, func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id, Transaction.kind == "expense", Transaction.date >= start, Transaction.date < end
    ).group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc()).all()
    rate = float((Decimal(str(income)) - Decimal(str(expense))) / Decimal(str(income)) * 100) if income else 0
    return jsonify({
        "month": month,
        "income": float(income), "expenses": float(expense),
        "balance": float(total_income) - float(total_expense),
        "month_net": float(income) - float(expense),
        "savings_rate": round(rate, 1),
        "transaction_count": q.count(),
        "recent": [tx_dict(x, user.currency) for x in recent],
        "categories": [{"name": c, "amount": float(a)} for c, a in category_rows],
        "currency": user.currency,
    })


@app.get("/api/transactions")
@login_required
def list_transactions():
    user = current_user()
    month = request.args.get("month")
    kind = request.args.get("kind")
    category = request.args.get("category")
    q = Transaction.query.filter_by(user_id=user.id)
    if month:
        start, end = month_range(month)
        q = q.filter(Transaction.date >= start, Transaction.date < end)
    if kind in {"income", "expense"}:
        q = q.filter_by(kind=kind)
    if category and category != "all":
        q = q.filter_by(category=category)
    rows = q.order_by(Transaction.date.desc(), Transaction.created_at.desc()).all()
    return jsonify({"transactions": [tx_dict(x, user.currency) for x in rows], "currency": user.currency})


@app.post("/api/transactions")
@login_required
def create_transaction():
    if not csrf_ok():
        return json_error("Invalid security token.", 403)
    data = request.get_json(silent=True) or {}
    try:
        kind = data.get("kind")
        if kind not in {"income", "expense"}:
            raise ValueError("Choose income or expense")
        amount = parse_amount(data.get("amount"))
        category = str(data.get("category", "Other")).strip() or "Other"
        if category not in CATEGORIES:
            category = "Other"
        tx_date = parse_date(data.get("date")) if data.get("date") else date.today()
    except ValueError as exc:
        return json_error(str(exc))
    tx = Transaction(user_id=current_user().id, kind=kind, amount=amount, category=category,
                     note=str(data.get("note", "")).strip()[:280], date=tx_date)
    db.session.add(tx)
    db.session.commit()
    return jsonify({"transaction": tx_dict(tx, current_user().currency)})


@app.put("/api/transactions/<int:tx_id>")
@login_required
def update_transaction(tx_id):
    if not csrf_ok():
        return json_error("Invalid security token.", 403)
    tx = Transaction.query.filter_by(id=tx_id, user_id=current_user().id).first_or_404()
    data = request.get_json(silent=True) or {}
    try:
        if data.get("kind") in {"income", "expense"}:
            tx.kind = data["kind"]
        if "amount" in data:
            tx.amount = parse_amount(data["amount"])
        if "category" in data:
            tx.category = data["category"] if data["category"] in CATEGORIES else "Other"
        if "note" in data:
            tx.note = str(data["note"]).strip()[:280]
        if "date" in data:
            tx.date = parse_date(data["date"])
    except ValueError as exc:
        return json_error(str(exc))
    db.session.commit()
    return jsonify({"transaction": tx_dict(tx, current_user().currency)})


@app.delete("/api/transactions/<int:tx_id>")
@login_required
def delete_transaction(tx_id):
    if not csrf_ok():
        return json_error("Invalid security token.", 403)
    tx = Transaction.query.filter_by(id=tx_id, user_id=current_user().id).first_or_404()
    db.session.delete(tx)
    db.session.commit()
    return jsonify({"ok": True})


@app.get("/api/budgets")
@login_required
def list_budgets():
    user = current_user()
    month = request.args.get("month", date.today().strftime("%Y-%m"))
    start, end = month_range(month)
    budgets = Budget.query.filter_by(user_id=user.id, month=month).order_by(Budget.category.asc()).all()
    spent_rows = db.session.query(Transaction.category, func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == user.id, Transaction.kind == "expense", Transaction.date >= start, Transaction.date < end
    ).group_by(Transaction.category).all()
    spent = {cat: float(amount) for cat, amount in spent_rows}
    return jsonify({"budgets": [{"id": b.id, "category": b.category, "amount": float(b.amount), "spent": spent.get(b.category, 0)} for b in budgets], "month": month, "currency": user.currency})


@app.post("/api/budgets")
@login_required
def create_budget():
    if not csrf_ok():
        return json_error("Invalid security token.", 403)
    data = request.get_json(silent=True) or {}
    category = data.get("category")
    month = str(data.get("month", date.today().strftime("%Y-%m")))
    if category not in CATEGORIES:
        return json_error("Choose a valid category.")
    try:
        amount = parse_amount(data.get("amount"))
    except ValueError as exc:
        return json_error(str(exc))
    b = Budget.query.filter_by(user_id=current_user().id, category=category, month=month).first()
    if b:
        b.amount = amount
    else:
        b = Budget(user_id=current_user().id, category=category, month=month, amount=amount)
        db.session.add(b)
    db.session.commit()
    return jsonify({"ok": True})


@app.delete("/api/budgets/<int:budget_id>")
@login_required
def delete_budget(budget_id):
    if not csrf_ok():
        return json_error("Invalid security token.", 403)
    b = Budget.query.filter_by(id=budget_id, user_id=current_user().id).first_or_404()
    db.session.delete(b)
    db.session.commit()
    return jsonify({"ok": True})


@app.get("/api/reports")
@login_required
def reports():
    user = current_user()
    month = request.args.get("month", date.today().strftime("%Y-%m"))
    start, end = month_range(month)
    q = Transaction.query.filter(Transaction.user_id == user.id, Transaction.date >= start, Transaction.date < end)
    by_day = {}
    for tx in q.order_by(Transaction.date.asc()).all():
        day = tx.date.day
        by_day.setdefault(day, {"income": 0, "expense": 0})[tx.kind] += float(tx.amount)
    days = []
    import calendar
    n = calendar.monthrange(start.year, start.month)[1]
    for d in range(1, n + 1):
        x = by_day.get(d, {"income": 0, "expense": 0})
        days.append({"day": d, "income": round(x["income"], 2), "expense": round(x["expense"], 2)})
    return jsonify({"days": days, "currency": user.currency})


@app.get("/api/profile")
@login_required
def profile():
    return jsonify({"user": user_json(current_user())})


@app.put("/api/profile")
@login_required
def update_profile():
    if not csrf_ok():
        return json_error("Invalid security token.", 403)
    user = current_user()
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", user.name)).strip()
    currency = str(data.get("currency", user.currency)).strip().upper()
    if len(name) < 2:
        return json_error("Name must be at least 2 characters.")
    if currency not in {"INR", "USD", "EUR", "GBP"}:
        return json_error("Choose a supported currency.")
    user.name, user.currency = name[:90], currency
    db.session.commit()
    return jsonify({"user": user_json(user)})


@app.get("/api/export.csv")
@login_required
def export_csv():
    user = current_user()
    month = request.args.get("month", date.today().strftime("%Y-%m"))
    start, end = month_range(month)
    rows = Transaction.query.filter(Transaction.user_id == user.id, Transaction.date >= start, Transaction.date < end).order_by(Transaction.date.asc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Category", "Amount", "Currency", "Note"])
    for tx in rows:
        writer.writerow([tx.date.isoformat(), tx.kind, tx.category, f"{tx.amount:.2f}", user.currency, tx.note or ""])
    response = make_response(output.getvalue())
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    response.headers["Content-Disposition"] = f'attachment; filename="cashflow-{month}.csv"'
    return response


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=int(os.getenv("PORT", "5000")))
