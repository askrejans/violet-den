"""VioletDen — Smart Home Dashboard integration for Home Assistant.

Registers VioletDen as a sidebar panel that embeds the dashboard in an iframe.
Authentication is handled automatically via HA token forwarding (postMessage).
"""

import logging
import os

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.panel_custom import async_register_panel

from .const import CONF_URL, DEFAULT_URL, DOMAIN, PANEL_ICON, PANEL_TITLE, PANEL_URL_PATH

_LOGGER = logging.getLogger(__name__)

PANEL_JS_FILENAME = "violetden-panel.js"
PANEL_JS_URL = f"/{DOMAIN}/{PANEL_JS_FILENAME}"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up VioletDen from a config entry."""
    url = entry.data.get(CONF_URL, DEFAULT_URL)

    # Register the panel JS as a static file served by HA
    panel_js_path = os.path.join(
        os.path.dirname(__file__), "frontend", PANEL_JS_FILENAME
    )

    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_JS_URL, panel_js_path, cache_headers=False)]
    )

    # Register the sidebar panel
    await async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name="violetden-panel",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=PANEL_JS_URL,
        require_admin=True,
        config={"url": url},
    )

    _LOGGER.info("VioletDen panel registered at /%s → %s", PANEL_URL_PATH, url)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove VioletDen panel."""
    hass.components.frontend.async_remove_panel(PANEL_URL_PATH)
    _LOGGER.info("VioletDen panel removed")
    return True
