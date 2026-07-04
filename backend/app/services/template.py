"""Template-Rendering fuer Kampagnen-Mails."""
from jinja2 import Template


def render_template(html_content: str, recipient_name: str, recipient_email: str, click_link: str) -> str:
    jinja_template = Template(html_content)
    return jinja_template.render(
        recipient_name=recipient_name,
        recipient_email=recipient_email,
        click_link=click_link,
    )
