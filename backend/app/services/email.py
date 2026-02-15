import os
import smtplib
import ssl
from email.message import EmailMessage


def _smtp_config():
    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "0") or "0")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    sender = os.environ.get("SMTP_FROM", user or "no-reply@example.com")
    use_ssl = (os.environ.get("SMTP_SSL", "").lower() in ("1", "true")) or port == 465
    starttls = (os.environ.get("SMTP_STARTTLS", "true").lower() in ("1", "true")) and not use_ssl
    timeout = int(os.environ.get("SMTP_TIMEOUT", "20") or "20")
    return host, port, user, password, sender, use_ssl, starttls, timeout


def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email via SMTP if configured; otherwise log to stdout and return True."""
    host, port, user, password, sender, use_ssl, starttls, timeout = _smtp_config()
    if not host or not port:
        # No SMTP configured; log for development
        print(f"[EMAIL:DEV] To={to} Subject={subject}\n{body}")
        return True
    try:
        msg = EmailMessage()
        msg["From"] = sender
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)

        # Debug log of SMTP settings in use (no secrets)
        try:
            print(f"[EMAIL:SMTP] host={host} port={port} ssl={use_ssl} starttls={starttls} from={sender} user={'set' if user else 'none'}")
        except Exception:
            pass

        if use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=timeout) as s:
                if user:
                    s.login(user, password or "")
                s.send_message(msg)
                try:
                    print(f"[EMAIL:SENT] to={to} subject={subject}")
                except Exception:
                    pass
        else:
            with smtplib.SMTP(host, port, timeout=timeout) as s:
                if starttls:
                    s.starttls(context=ssl.create_default_context())
                if user:
                    s.login(user, password or "")
                s.send_message(msg)
                try:
                    print(f"[EMAIL:SENT] to={to} subject={subject}")
                except Exception:
                    pass
        return True
    except Exception as e:
        print(f"[EMAIL:ERROR] Failed to send to {to}: {e}")
        return False
