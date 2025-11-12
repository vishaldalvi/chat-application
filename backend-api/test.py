# test_centrifugo.py
import asyncio
import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from centrifugo_client import centrifugo_client


async def test_centrifugo():
    print("Testing Centrifugo connection...")

    # Test token generation
    try:
        token = centrifugo_client.generate_token("test_user_123")
        print(f"✓ Token generated: {token[:50]}...")
    except Exception as e:
        print(f"✗ Token generation failed: {e}")
        return

    # Test publishing
    test_data = {
        "type": "test",
        "message": "Hello from test script",
        "timestamp": "2024-01-01T00:00:00",
    }

    success = await centrifugo_client.publish(channel="chat-68dbc0339a3dedd010d23a05", data=test_data)

    if success:
        print("✓ Message published successfully")
    else:
        print("✗ Failed to publish message")

    print("Test completed")


if __name__ == "__main__":
    asyncio.run(test_centrifugo())
