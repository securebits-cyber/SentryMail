# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Template-Rendering fuer Kampagnen-Mails."""
from jinja2 import Template


def render_template(html_content: str, recipient_name: str, recipient_email: str, click_link: str) -> str:
    jinja_template = Template(html_content)
    return jinja_template.render(
        recipient_name=recipient_name,
        recipient_email=recipient_email,
        click_link=click_link,
    )
