import os
import time
from datetime import datetime, date, timedelta
import argparse

from app import create_app, db
from app.models.user import User
from app.models.bill import Bill
from app.services.email import send_email
from app.services.valkey import get_redis


def due_date_for_bill(b: Bill, today: date) -> date | None:
    if b.due_date:
        return b.due_date
    if b.due_day:
        # Current month's due day
        try:
            day = max(1, min(int(b.due_day), 28))
        except Exception:
            day = 1
        return date(today.year, today.month, day)
    return None


def days_between(a: date, b: date) -> int:
    return (a - b).days


def process_notifications():
    """Run notifications inside an active Flask app context and return a summary."""
    r = get_redis()
    today_dt = datetime.utcnow()
    today = today_dt.date()
    users = User.query.all()

    summary = {
        "date": today.isoformat(),
        "users": 0,
        "bills_checked": 0,
        "reminders_attempted": 0,
        "overdue_attempted": 0,
        "emails_sent": 0,
        "recipients": [],
    }

    for u in users:
        summary["users"] += 1
        email = u.get_email()
        bills = Bill.query.filter_by(user_id=u.id).all()
        for b in bills:
            summary["bills_checked"] += 1
            if b.paid_at:
                continue
            due = due_date_for_bill(b, today)
            if not due:
                continue
            days = days_between(due, today)
            remind = int(b.reminder_days_before or 0)
            # Reminder exactly X days before
            if remind > 0 and days == remind:
                summary["reminders_attempted"] += 1
                subj = f"Reminder: '{b.name}' due in {remind} day(s)"
                body = (
                    f"Hi,\n\nYour bill '{b.name}' of ${(b.amount_cents or 0)/100:.2f} is due on {due.isoformat()}.\n"
                    f"This is a reminder {remind} day(s) in advance.\n\n- Nightshade"
                )
                if send_email(email, subj, body):
                    summary["emails_sent"] += 1
                    summary["recipients"].append(email)
                continue
            # Overdue: send daily
            if days < 0:
                summary["overdue_attempted"] += 1
                # check last sent to avoid spamming more than once per day
                key = f"bill_notify:last:{b.id}:{today.isoformat()}"
                if r and r.get(key):
                    continue
                subj = f"Overdue: '{b.name}' was due {abs(days)} day(s) ago"
                body = (
                    f"Hi,\n\nYour bill '{b.name}' of ${(b.amount_cents or 0)/100:.2f} was due on {due.isoformat()} and is now overdue by {abs(days)} day(s).\n"
                    f"Please make a payment or mark it as paid in the app.\n\n- Nightshade"
                )
                if send_email(email, subj, body):
                    summary["emails_sent"] += 1
                    summary["recipients"].append(email)
                    if r:
                        # set key for 24h
                        r.setex(key, 24 * 60 * 60, "1")
    print("Notifications run complete.")
    return summary


def run_notifications():
    app = create_app()
    with app.app_context():
        process_notifications()


def get_schedule_from_env():
    hour = int(os.environ.get("NOTIFY_HOUR", "9") or "9")
    minute = int(os.environ.get("NOTIFY_MINUTE", "0") or "0")
    return max(0, min(hour, 23)), max(0, min(minute, 59))


def seconds_until_next_run(hour: int, minute: int) -> float:
    now = datetime.now()
    next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if next_run <= now:
        next_run = next_run + timedelta(days=1)
    return (next_run - now).total_seconds()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nightshade bill notifications")
    parser.add_argument("--daemon", action="store_true", help="Run forever and send notifications daily at the scheduled time")
    args = parser.parse_args()

    if args.daemon:
        h, m = get_schedule_from_env()
        print(f"Notification scheduler started. Daily at {h:02d}:{m:02d}.")
        while True:
            try:
                sleep_secs = seconds_until_next_run(h, m)
                time.sleep(max(1, sleep_secs))
                run_notifications()
                # Avoid double-run within the same minute
                time.sleep(60)
            except KeyboardInterrupt:
                print("Scheduler stopped.")
                break
    else:
        run_notifications()
