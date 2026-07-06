# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

import pytest

from app.utils.useragent import parse_user_agent

_CHROME_WIN = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
_SAFARI_IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)
_EDGE_WIN = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
)
_FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0"


@pytest.mark.parametrize(
    "ua,browser,os_name,device",
    [
        (_CHROME_WIN, "Chrome", "Windows 10/11", "desktop"),
        (_SAFARI_IPHONE, "Safari", "iOS", "mobile"),
        (_EDGE_WIN, "Edge", "Windows 10/11", "desktop"),
        (_FIREFOX_LINUX, "Firefox", "Linux", "desktop"),
    ],
)
def test_parse_known_agents(ua, browser, os_name, device):
    assert parse_user_agent(ua) == (browser, os_name, device)


def test_edge_wins_over_chrome_marker():
    # Edge-UAs enthalten auch "Chrome/..."; der spezifischere Marker muss gewinnen.
    assert parse_user_agent(_EDGE_WIN)[0] == "Edge"


def test_bot_detected():
    assert parse_user_agent("Googlebot/2.1 (+http://www.google.com/bot.html)") == (None, None, "bot")


def test_empty_agent():
    assert parse_user_agent(None) == (None, None, None)
    assert parse_user_agent("") == (None, None, None)
