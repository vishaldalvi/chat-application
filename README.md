# Chat-Application

Make sure mongodb service is started.
Centrifugo is started.

Run back-end with below cmd
```
cd backend-api/
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Run front-end with below cmd
```
cd chat-frontend
npm run dev
