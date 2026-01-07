import axios from "axios";
import Cookies from "js-cookie";

const API_BASE_URL = import.meta.env.API_BASE_URL || "/api";
console.log(API_BASE_URL);
class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      // Remove withCredentials for now, handle auth via headers only
      // withCredentials: true,
    });

    // Add token to requests if available
    this.client.interceptors.request.use(
      (config) => {
        const token = Cookies.get("access_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Handle token expiration
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  handleUnauthorized() {
    Cookies.remove("access_token");
    Cookies.remove("user");
    window.location.href = "/login";
  }

  // Auth APIs
  async register(userData) {
    const response = await this.client.post("/auth/register", userData);
    return response.data;
  }

  async login(credentials) {
    // Create a temporary client without interceptor for login
    const tempClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await tempClient.post("/auth/login", credentials);
    if (response.data.access_token) {
      // Set cookie with expiration (adjust as needed)
      Cookies.set("access_token", response.data.access_token, {
        expires: 7, // 7 days
        secure: false, // Set to false for HTTP development
        sameSite: "lax", // Use 'lax' instead of 'strict' for development
      });

      Cookies.set("user", JSON.stringify(response.data.user), {
        expires: 7,
        secure: false,
        sameSite: "lax",
      });
    }
    return response.data;
  }

  async logout() {
    try {
      await this.client.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      Cookies.remove("access_token");
      Cookies.remove("user");
    }
  }

  // ... rest of your methods remain the same
  async getCentrifugoToken() {
    const response = await this.client.get("/centrifugo/token");
    return response.data.token;
  }

  // User APIs
  async getCurrentUser() {
    const response = await this.client.get("/users/me");
    return response.data;
  }

  async getUsers(search = "") {
    const params = search ? { search } : {};
    const response = await this.client.get("/users", { params });
    return response.data;
  }

  // Chat APIs
  async createChat(chatData) {
    const response = await this.client.post("/chats", chatData);
    return response.data;
  }

  async getUserChats() {
    const response = await this.client.get("/chats");
    return response.data;
  }

  async getChat(chatId) {
    const response = await this.client.get(`/chats/${chatId}`);
    return response.data;
  }

  // Message APIs - Updated to handle both text and file messages
  async sendMessage(messageData) {
    // Check if messageData is FormData (file upload) or regular object
    if (messageData instanceof FormData) {
      // For file uploads, use multipart/form-data
      const response = await this.client.post("/messages", messageData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } else {
      // For text messages, use regular JSON
      const response = await this.client.post("/messages", messageData);
      return response.data;
    }
  }

  async getChatMessages(chatId, page = 1, limit = 50) {
    const response = await this.client.get(`/chats/${chatId}/messages`, {
      params: { page, limit },
    });
    return response.data;
  }

  async sendTypingIndicator(typingData) {
    const response = await this.client.post("/typing", typingData);
    return response.data;
  }

  async updateOnlineStatus(statusData) {
    const response = await this.client.post("/online-status", statusData);
    return response.data;
  }
}

export const apiService = new ApiService();
