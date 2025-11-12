import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { apiService } from "../services/api";
import { centrifugoService } from "../services/centrifugo";

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [centrifugoReady, setCentrifugoReady] = useState(false);
  const { user, isAuthenticated } = useAuth();

  const subscriptions = useRef(new Set());
  const retryCount = useRef(0);
  const maxRetries = useRef(5);
  const retryTimeout = useRef(null);
  const pendingSubscriptions = useRef(new Set());
  const isInitializing = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      initializeCentrifugo();
      loadChats();
      updateOnlineStatus(true);
    }

    return () => {
      if (isAuthenticated && user) {
        updateOnlineStatus(false);
      }
      subscriptions.current.forEach((channel) =>
        centrifugoService.unsubscribe(channel)
      );
      subscriptions.current.clear();

      // Clear any pending retries
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
      }
    };
  }, [isAuthenticated, user]);

  const initializeCentrifugo = async () => {
    if (isInitializing.current) {
      console.log("Centrifugo initialization already in progress...");
      return;
    }

    isInitializing.current = true;
    retryCount.current = 0;

    try {
      await attemptCentrifugoInitialization();
    } catch (error) {
      console.error("Centrifugo initialization failed:", error);
      scheduleRetry();
    }
  };

  const attemptCentrifugoInitialization = async () => {
    console.log(
      `Attempting Centrifugo initialization (attempt ${
        retryCount.current + 1
      }/${maxRetries.current})`
    );

    const token = await apiService.getCentrifugoToken();
    await centrifugoService.initialize(token);

    setCentrifugoReady(true);
    isInitializing.current = false;
    retryCount.current = 0;

    console.log("Centrifugo initialized successfully");

    // Process any pending subscriptions
    processPendingSubscriptions();
  };

  const scheduleRetry = () => {
    if (retryCount.current >= maxRetries.current) {
      console.error("Max retry attempts reached for Centrifugo initialization");
      isInitializing.current = false;
      return;
    }

    retryCount.current++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, retryCount.current - 1), 30000);

    console.log(
      `Scheduling retry in ${delay}ms (attempt ${retryCount.current})`
    );

    retryTimeout.current = setTimeout(() => {
      attemptCentrifugoInitialization().catch(scheduleRetry);
    }, delay);
  };

  const processPendingSubscriptions = () => {
    if (pendingSubscriptions.current.size > 0) {
      console.log(
        `Processing ${pendingSubscriptions.current.size} pending subscriptions`
      );

      pendingSubscriptions.current.forEach((chatId) => {
        subscribeToChat(chatId);
      });

      pendingSubscriptions.current.clear();
    }
  };

  const loadChats = async () => {
    try {
      setLoading(true);
      const chatsData = await apiService.getUserChats();
      setChats(chatsData);
    } catch (error) {
      console.error("Failed to load chats:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatMessages = async (chatId) => {
    try {
      setLoading(true);
      const messagesData = await apiService.getChatMessages(chatId);
      setMessages(messagesData);

      // Subscribe after loading messages
      await subscribeToChat(chatId);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChat = async (chatId) => {
    const channel = `chat-${chatId}`;

    if (subscriptions.current.has(channel)) {
      console.log(`Already subscribed to ${channel}`);
      return;
    }

    // Wait for Centrifugo to be ready with retry mechanism
    if (!centrifugoReady) {
      console.log("Centrifugo not ready, adding to pending subscriptions...");
      pendingSubscriptions.current.add(chatId);

      // If Centrifugo is not initializing, try to initialize it
      if (!isInitializing.current) {
        initializeCentrifugo();
      }
      return;
    }

    try {
      await centrifugoService.subscribe(channel, {
        onMessage: (data) => {
          console.log("Received WebSocket message:", data);
          switch (data.type) {
            case "new_message":
              setMessages((prev) => {
                // Avoid duplicates
                if (prev.some((msg) => msg.id === data.message.id)) {
                  return prev;
                }
                return [...prev, data.message];
              });
              break;
            case "typing_indicator":
              handleTypingIndicator(data);
              break;
            case "online_status":
              handleOnlineStatus(data);
              break;
            default:
              console.log("Unknown message type:", data.type);
          }
        },
        onError: (error) => {
          console.error(`Subscription error for ${channel}:`, error);
          // Remove from active subscriptions and retry
          subscriptions.current.delete(channel);
          scheduleSubscriptionRetry(chatId);
        },
        onDisconnect: () => {
          console.log(`Disconnected from ${channel}`);
          subscriptions.current.delete(channel);
          setCentrifugoReady(false);
          // Reinitialize Centrifugo
          initializeCentrifugo();
        },
      });

      subscriptions.current.add(channel);
      console.log(`Successfully subscribed to ${channel}`);
    } catch (error) {
      console.error(`Failed to subscribe to ${channel}:`, error);
      scheduleSubscriptionRetry(chatId);
    }
  };

  const scheduleSubscriptionRetry = (chatId, attempt = 1) => {
    const maxSubscriptionRetries = 3;

    if (attempt > maxSubscriptionRetries) {
      console.error(`Max subscription retries reached for chat ${chatId}`);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);

    console.log(
      `Scheduling subscription retry for chat ${chatId} in ${delay}ms (attempt ${attempt})`
    );

    setTimeout(() => {
      if (centrifugoReady) {
        subscribeToChat(chatId);
      } else {
        // If Centrifugo isn't ready, add back to pending
        pendingSubscriptions.current.add(chatId);
      }
    }, delay);
  };

  const handleTypingIndicator = (data) => {
    setTypingUsers((prev) => {
      const updated = prev.filter((u) => u.user_id !== data.user_id);
      return data.is_typing ? [...updated, data] : updated;
    });

    if (data.is_typing) {
      setTimeout(() => {
        setTypingUsers((prev) =>
          prev.filter((u) => u.user_id !== data.user_id)
        );
      }, 3000);
    }
  };

  const handleOnlineStatus = (data) => {
    setOnlineUsers((prev) => {
      const newSet = new Set(prev);
      if (data.is_online) {
        newSet.add(data.user_id);
      } else {
        newSet.delete(data.user_id);
      }
      return newSet;
    });
  };

  // In your ChatContext
  const sendMessage = async (content, replyTo = null) => {
    if (!currentChat) return;

    try {
      const payload = {
        chat_id: currentChat.id,
        content: content,
        message_type: "text",
        reply_to: replyTo,
      };

      await apiService.sendMessage(payload);
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  };

  const sendFileMessage = async (file, caption = "", replyTo = null) => {
    if (!currentChat || !file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chat_id", currentChat.id);
      formData.append("message_type", "file");

      if (caption && caption.trim()) {
        formData.append("content", caption);
      }

      if (replyTo) {
        formData.append("reply_to", replyTo);
      }

      const response = await apiService.sendMessage(formData);
      return response;
    } catch (error) {
      console.error("Failed to send file message:", error);
      throw error;
    }
  };

  const sendTypingIndicator = async (isTyping) => {
    if (!currentChat || !user) return;
    try {
      await apiService.sendTypingIndicator({
        chat_id: currentChat.id,
        user_id: user.id,
        username: user.username,
        is_typing: isTyping,
      });
    } catch (error) {
      console.error("Failed to send typing indicator:", error);
    }
  };

  const updateOnlineStatus = async (isOnline) => {
    if (!user) return;
    try {
      await apiService.updateOnlineStatus({
        user_id: user.id,
        username: user.username,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to update online status:", error);
    }
  };

  const createChat = async (chatData) => {
    try {
      const newChat = await apiService.createChat(chatData);
      setChats((prev) => [newChat, ...prev]);
      return newChat;
    } catch (error) {
      console.error("Failed to create chat:", error);
      throw error;
    }
  };

  // Method to manually retry Centrifugo connection
  const retryCentrifugoConnection = () => {
    if (!isInitializing.current) {
      retryCount.current = 0;
      initializeCentrifugo();
    }
  };

  const value = {
    chats,
    currentChat,
    messages,
    typingUsers,
    onlineUsers,
    loading,
    centrifugoReady,
    setCurrentChat,
    loadChats,
    loadChatMessages,
    sendMessage,
    sendFileMessage,
    sendTypingIndicator,
    createChat,
    retryCentrifugoConnection, // Export retry function
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
