# Chat Application

## Installation

1. Clone the repository:
```
git clone https://github.com/your-username/chat-app.git
```

2. Install the dependencies:
```
cd chat-app
pip install -r requirements.txt
```

3. Set up the environment variables:
```
cp .env.example .env
```
Then, update the values in the `.env` file with your own configuration.

4. Run the database migrations:
```
python manage.py migrate
```

5. Start the development server:
```
python manage.py runserver
```

The application should now be running at `http://localhost:8000`.

## Usage

1. Register a new user by navigating to the `/auth/register` endpoint.
2. Log in using the `/auth/login` endpoint.
3. Interact with the chat functionality by using the following endpoints:
   - `/chats`: Create, retrieve, and manage chats.
   - `/messages`: Send and retrieve messages within a chat.
   - `/typing`: Send typing indicators to other users in a chat.
   - `/online-status`: Update your online status.

## API

The API endpoints are documented in the `chat_app_api.yaml` file, which can be viewed using a tool like [Swagger UI](https://swagger.io/tools/swagger-ui/).

## Contributing

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/your-feature`.
3. Make your changes and commit them: `git commit -am 'Add some feature'`.
4. Push to the branch: `git push origin feature/your-feature`.
5. Submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Testing

To run the tests:
```
python manage.py test
```
