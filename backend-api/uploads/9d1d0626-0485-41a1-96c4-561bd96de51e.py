import random
import time
from datetime import datetime, timedelta
from faker import Faker

# Import your actual function
from common.common_api_functions import add_entrust_logs

fake = Faker()


# Example dummy request-like object for metadata extraction
class DummyRequest:
    def __init__(self):
        self.headers = {"user-agent": fake.user_agent()}
        self.client = type("obj", (object,), {"host": fake.ipv4()})()


# Optional stub if get_user_ip or user_agent_parser are used in add_entrust_logs
def get_user_ip(request):
    return getattr(request.client, "host", "127.0.0.1")


# Example pool of values for randomized log generation
OPERATIONS = ["CREATE", "UPDATE", "DELETE"]
MODULES = ["Case", "User", "Client", "Invoice", "Task"]
ENTITY_NAMES = ["case", "user", "client", "invoice", "task"]

# Fake users to simulate different user_id sets
USER_POOL = [
    {"user_id": 2201, "username": "vishal.d"},
    {"user_id": 2491, "username": "chinmay.n"},
    {"user_id": 3130, "username": "chetan.a"},
    {"user_id": 2797, "username": "pragati.k"},
    {"user_id": 2758, "username": "kajal.s"},
]


def generate_fake_action_details(operation):
    """Generate random old/new value pairs based on operation."""
    if operation == "CREATE":
        return {
            "create": {
                "oldValues": {"title": None, "subtitle": None, "date": None},
                "newValues": {
                    "title": fake.sentence(nb_words=3),
                    "subtitle": fake.word(),
                    "date": fake.date_this_year().isoformat(),
                },
            }
        }
    elif operation == "UPDATE":
        return {
            "update": {
                "oldValues": {"status": "Pending"},
                "newValues": {"status": "Completed"},
            }
        }
    else:  # DELETE
        return {
            "delete": {"oldValues": {"active": True}, "newValues": {"active": False}}
        }


def seed_entrust_logs(record_count=100, log=None):
    print(f"Seeding {record_count} entrust logs...")
    for i in range(record_count):
        user = random.choice(USER_POOL)
        operation = random.choice(OPERATIONS)
        module = random.choice(MODULES)
        entity_name = random.choice(ENTITY_NAMES)
        entity_id = random.randint(10000, 99999)
        action_details = generate_fake_action_details(operation)
        req = DummyRequest()

        try:
            add_entrust_logs(
                user_id=user["user_id"],
                operation=operation,
                module=module,
                entity_id=entity_id,
                entity_name=entity_name,
                action_details=action_details,
                metadata=None,
                request=req,
                log=log,
            )
            print(
                f"[{i+1}] ✅ Inserted log for user {user['username']} | {operation} {module}"
            )
        except Exception as e:
            print(f"[{i+1}] ❌ Failed: {e}")

        # Optional small delay for timestamp variation
        time.sleep(0.02)

    print("✅ Seeding complete!")


if __name__ == "__main__":
    seed_entrust_logs(100)
