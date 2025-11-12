import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChat } from "../contexts/ChatContext";
import { useAuth } from "../contexts/AuthContext";
import ChatMessage from "../components/ChatMessage";
import TypingIndicator from "../components/TypingIndicator";
import {
  Send,
  ArrowLeft,
  Wifi,
  WifiOff,
  Smile,
  Paperclip,
  X,
  FileText,
  Image,
  File,
} from "lucide-react";
import Cookies from "js-cookie";
import EmojiPicker from "emoji-picker-react";
import DTalksLanding from "../pages/DtalksLanding";

const ChatRoom = () => {
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const user_name = JSON.parse(Cookies.get("user"))?.username;
  const [loggedInUser, setLoggedInUser] = useState(user_name);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);

  const { chatId } = useParams();
  const navigate = useNavigate();
  const {
    currentChat,
    messages,
    typingUsers,
    centrifugoReady,
    sendMessage,
    sendTypingIndicator,
    loadChatMessages,
    sendFileMessage, // We'll need to add this to the ChatContext
  } = useChat();
  const { user } = useAuth();

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (chatId) {
      loadChatMessages(chatId);
    }
  }, [chatId]);

  // Scroll to bottom when messages change or component mounts
  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Scroll to bottom on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 1000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    // If there's a selected file, send it first
    if (selectedFile) {
      await handleSendFile();
      return;
    }

    if (!newMessage.trim()) return;

    setIsTyping(false);
    sendTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      await sendMessage(newMessage);
      setNewMessage("");
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      await sendFileMessage(selectedFile, newMessage);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Reset form
      setSelectedFile(null);
      setNewMessage("");
      setIsUploading(false);

      setTimeout(() => {
        setUploadProgress(0);
        scrollToBottom();
      }, 500);
    } catch (error) {
      console.error("Failed to send file:", error);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (e.g., 10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      alert("File size too large. Please select a file smaller than 10MB.");
      return;
    }

    setSelectedFile(file);
    // Reset file input
    e.target.value = "";
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Add emoji to message
  const onEmojiClick = (emojiObject) => {
    setNewMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);

    // Focus back on input
    const input = document.getElementById("message-input");
    if (input) {
      input.focus();
    }
  };

  // Get file icon based on file type
  const getFileIcon = (file) => {
    if (!file) return <File size={20} />;

    const fileType = file.type.split("/")[0];
    switch (fileType) {
      case "image":
        return <Image size={20} />;
      case "application":
        if (file.type.includes("pdf")) {
          return <FileText size={20} />;
        }
        return <File size={20} />;
      default:
        return <File size={20} />;
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    if (!messages || messages.length === 0) return [];

    const grouped = [];
    let currentDate = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.created_at).toDateString();

      if (messageDate !== currentDate) {
        grouped.push({
          type: "date",
          date: messageDate,
          timestamp: message.created_at,
        });
        currentDate = messageDate;
      }

      grouped.push({
        type: "message",
        data: message,
      });
    });

    return grouped;
  };

  const groupedMessages = groupMessagesByDate();

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  };

  if (!currentChat) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h3 className="text-3xl font-semibold text-gray-900">D-Talks</h3>
          <p className="text-gray-500">Where Every Chat Begins with D.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/chats")}
              className="md:hidden text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {currentChat.chat_type === "direct"
                  ? currentChat.participant_usernames
                      .find(
                        (p) =>
                          !p.includes(
                            loggedInUser ||
                              currentChat?.last_message?.sender_username
                          )
                      )
                      ?.split("||||")[1] || "Unknown User"
                  : currentChat.name}
              </h2>
              <p className="text-sm text-gray-500 capitalize">
                {currentChat.chat_type}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {centrifugoReady ? (
              <Wifi size={16} className="text-green-500" />
            ) : (
              <WifiOff size={16} className="text-red-500" />
            )}
            <span className="text-xs text-gray-500">
              {centrifugoReady ? "Connected" : "Connecting..."}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-gray-50"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {groupedMessages.length > 0 ? (
            groupedMessages.map((item, index) => {
              if (item.type === "date") {
                return (
                  <div
                    key={`date-${item.timestamp}`}
                    className="flex items-center justify-center my-6"
                  >
                    <div className="bg-gray-200 px-3 py-1 rounded-full">
                      <span className="text-xs font-medium text-gray-600">
                        {formatDate(item.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              } else {
                return (
                  <ChatMessage
                    key={item.data.id}
                    message={item.data}
                    currentUserId={user.id}
                  />
                );
              }
            })
          ) : (
            <div className="text-center text-gray-500 py-8">
              Start of conversation
            </div>
          )}
          <TypingIndicator typingUsers={typingUsers} />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* File Preview */}
      {selectedFile && (
        <div className="bg-blue-50 border-t border-blue-200 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="text-blue-600">{getFileIcon(selectedFile)}</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={removeSelectedFile}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
          <div className="flex space-x-4">
            {/* Emoji Picker Container */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={!centrifugoReady || isUploading}
              >
                <Smile size={20} />
              </button>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full mb-2 left-0 z-10"
                >
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    width={350}
                    height={400}
                    searchDisabled={false}
                    skinTonesDisabled={true}
                    previewConfig={{
                      showPreview: false,
                    }}
                    theme="light"
                  />
                </div>
              )}
            </div>

            {/* File Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!centrifugoReady || isUploading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <Paperclip size={20} />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: "none" }}
              disabled={!centrifugoReady || isUploading}
            />

            <div className="flex-1 relative">
              <input
                id="message-input"
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder={
                  centrifugoReady
                    ? selectedFile
                      ? "Add a caption (optional)..."
                      : "Type a message..."
                    : "Connecting to chat..."
                }
                disabled={!centrifugoReady || isUploading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={
                (!newMessage.trim() && !selectedFile) ||
                !centrifugoReady ||
                isUploading
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>{selectedFile ? "Send File" : "Send"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatRoom;
