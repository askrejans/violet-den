"""Config flow for VioletDen integration."""

import aiohttp
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_URL, DEFAULT_URL, DOMAIN


class VioletDenConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for VioletDen."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step — ask for VioletDen URL."""
        errors = {}

        if user_input is not None:
            url = user_input[CONF_URL].rstrip("/")

            # Prevent duplicate entries
            await self.async_set_unique_id(DOMAIN)
            self._abort_if_unique_id_configured()

            # Validate that VioletDen is reachable
            try:
                session = async_get_clientsession(self.hass, verify_ssl=False)
                async with session.get(
                    f"{url}/api/setup-status", timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        return self.async_create_entry(
                            title="VioletDen",
                            data={CONF_URL: url},
                        )
                    errors["base"] = "cannot_connect"
            except (aiohttp.ClientError, TimeoutError):
                errors["base"] = "cannot_connect"
            except Exception:  # noqa: BLE001
                errors["base"] = "unknown"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_URL, default=DEFAULT_URL): str,
                }
            ),
            errors=errors,
        )
