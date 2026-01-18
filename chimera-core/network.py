"""
Sovereign Mobile Proxy Integration (Decodo Edition).

- Carrier-Sticky: Decodo session-id pins a mobile IP for the duration of a
  deep_search mission. Optional carrier suffix (e.g. -carrier-att) to prefer
  a mobile carrier when the GPS has signaled poor health for another.
- TCP Fingerprint: MTU and TTL hints for 5G/LTE to pass passive OS fingerprinting.
  Apply at proxy/OS or container level when possible; the browser does not set these.

TLS / JA3: For native Chrome TLS (JA3 match to real Chrome), set CHROMIUM_CHANNEL=chrome
in the worker (chimera-core). User-Agent and Sec-Ch-Ua consistency with Chrome 142/Windows 11
are enforced in workers.py and stealth.py; see CHROME_UA_VERSION and CHROME_UA_PLATFORM.
"""

import os
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# 5G/LTE mobile: typical TTL 64, MTU 1500. Use for container/VM or proxy config.
MTU_TARGET = int(os.getenv("NETWORK_MTU_TARGET", "1500"))
TTL_TARGET = int(os.getenv("NETWORK_TTL_TARGET", "64"))


def should_rotate_session_on_403() -> bool:
    """
    When a 403 (e.g. Cloudflare block) is seen on a document mid-mission, the
    worker performs a complete session rotation: new context with a new
    sticky_session_id (e.g. mission_id_r403_<ts>) so Decodo assigns a fresh
    mobile IP. Wired: workers.py response listener sets _seen_403 on document
    403; _check_403_and_rotate calls rotate_hardware_identity when this
    returns True.
    """
    return True


def get_tcp_fingerprint_hints() -> Dict[str, int]:
    """
    MTU and TTL for a standard 5G/LTE mobile connection (passive OS fingerprinting).
    Apply via: iptables (TTL), `ip link set mtu`, or proxy/Decodo if they support it.
    """
    return {"MTU": MTU_TARGET, "TTL": TTL_TARGET}


def get_proxy_config(
    sticky_session_id: Optional[str] = None,
    carrier: Optional[str] = None,
) -> Optional[Dict[str, str]]:
    """
    Build proxy config for Playwright: server, username, password.

    Decodo sticky session: appends session-{id} to the username so the same
    mobile IP is used for the whole mission. Decodo expects session-<SESSION_ID>
    in the username; SESSION_ID can be any string (e.g. mission_id).

    - sticky_session_id: when set, appends "-session-{sticky_session_id}" so
      a single mission stays pinned to one mobile carrier IP for its lifetime.
    - carrier: appends "-carrier-{att|tmobile|verizon|sprint}" when set (GPS
      carrier health). Decodo may use this for carrier targeting if supported.
    """
    url = os.getenv("PROXY_URL") or os.getenv("ROTATING_PROXY_URL")
    if not url and os.getenv("DECODO_API_KEY"):
        user = os.getenv("DECODO_USER", "user")
        key = os.getenv("DECODO_API_KEY", "")
        url = f"http://{user}:{key}@gate.decodo.com:7000"
    if not url:
        return None
    try:
        p = urlparse(url)
        server = f"http://{p.hostname}:{p.port or 80}" if p.hostname else None
        username, password = p.username, p.password
        if not server or not username or not password:
            return None

        # Decodo: [base]-carrier-{c}-session-{id}; session-<ID> is required for sticky IP
        parts = [username]
        if carrier:
            c = str(carrier).lower().replace("_", "").strip() or None
            if c:
                parts.append(f"carrier-{c}")
        if sticky_session_id:
            parts.append(f"session-{sticky_session_id}")

        if len(parts) > 1:
            username = "-".join(parts)

        return {"server": server, "username": username, "password": password}
    except Exception as e:
        logger.debug("get_proxy_config: %s", e)
        return None
