import aiohttp
import jwt
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
import os
from decouple import config
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CentrifugoClient:
    def __init__(self):
        self.api_url = config("CENTRIFUGO_API_URL", "http://localhost:9001").rstrip("/")
        self.api_key = config("CENTRIFUGO_API_KEY", "your-api-key-here")
        self.secret = config("CENTRIFUGO_SECRET", "your-secret-here")
        self.timeout = aiohttp.ClientTimeout(total=10)

        # Validate configuration
        if not self.api_key or self.api_key == "your-api-key-here":
            logger.warning("Centrifugo API key not configured properly")
        if not self.secret or self.secret == "your-secret-here":
            logger.warning("Centrifugo secret not configured properly")

    def generate_token(self, user_id: str, expires_in: int = 3600) -> str:
        """Generate JWT token for Centrifugo connection"""
        try:
            payload = {"sub": user_id, "exp": int(time.time()) + expires_in}
            token = jwt.encode(payload, self.secret, algorithm="HS256")
            # Handle bytes/string issue with PyJWT
            return token.decode("utf-8") if isinstance(token, bytes) else token
        except Exception as e:
            logger.error(f"Error generating Centrifugo token: {e}")
            raise

    async def publish(self, channel: str, data: Dict[str, Any]) -> bool:
        """Publish message to Centrifugo channel"""
        payload = {"method": "publish", "params": {"channel": channel, "data": data}}

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"apikey {self.api_key}",
        }

        try:
            logger.info(f"Publishing to channel: {channel}, data: {data}")

            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(
                    f"{self.api_url}/api", json=payload, headers=headers
                ) as response:

                    response_text = await response.text()
                    logger.info(
                        f"Centrifugo response status: {response.status}, body: {response_text}"
                    )

                    if response.status == 200:
                        result = await response.json()
                        if result.get("error"):
                            logger.error(f"Centrifugo publish error: {result['error']}")
                            return False
                        logger.info("Message published successfully to Centrifugo")
                        return True
                    else:
                        logger.error(
                            f"Centrifugo HTTP error: {response.status}, response: {response_text}"
                        )
                        return False

        except aiohttp.ClientError as e:
            logger.error(f"Network error publishing to Centrifugo: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error publishing to Centrifugo: {e}")
            return False

    async def broadcast(self, channels: List[str], data: Dict[str, Any]) -> bool:
        """Broadcast message to multiple channels"""
        payload = {
            "method": "broadcast",
            "params": {"channels": channels, "data": data},
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"apikey {self.api_key}",
        }

        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(
                    f"{self.api_url}/api", json=payload, headers=headers
                ) as response:

                    if response.status == 200:
                        result = await response.json()
                        if result.get("error"):
                            logger.error(
                                f"Centrifugo broadcast error: {result['error']}"
                            )
                            return False
                        return True
                    else:
                        response_text = await response.text()
                        logger.error(
                            f"Centrifugo HTTP error: {response.status}, response: {response_text}"
                        )
                        return False
        except Exception as e:
            logger.error(f"Error broadcasting to Centrifugo: {e}")
            return False

    async def get_online_users(self, channel: str) -> Optional[List[str]]:
        """Get online users in a channel"""
        payload = {"method": "presence", "params": {"channel": channel}}

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"apikey {self.api_key}",
        }

        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(
                    f"{self.api_url}/api", json=payload, headers=headers
                ) as response:

                    if response.status == 200:
                        result = await response.json()
                        if result.get("error"):
                            logger.error(
                                f"Centrifugo presence error: {result['error']}"
                            )
                            return None

                        presence_data = result.get("result", {})
                        return list(presence_data.get("presence", {}).keys())
                    else:
                        return None
        except Exception as e:
            logger.error(f"Error getting presence from Centrifugo: {e}")
            return None


# Create Centrifugo client instance
centrifugo_client = CentrifugoClient()
