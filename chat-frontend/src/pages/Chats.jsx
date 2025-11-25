import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChat } from "../contexts/ChatContext";
import { useAuth } from "../contexts/AuthContext";
import ChatList from "../components/ChatList";
import ChatRoom from "./ChatRoom";
import { LogOut, Users, Plus, X } from "lucide-react";
import { apiService } from "../services/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHouse } from "@fortawesome/free-regular-svg-icons";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

const Chats = () => {
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [newChatData, setNewChatData] = useState({
    name: "",
    chat_type: "direct",
    participants: [],
    description: "",
  });

  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user, logout } = useAuth();
  const {
    chats,
    currentChat,
    setCurrentChat,
    createChat,
    onlineUsers,
    loadChats,
  } = useChat();

  useEffect(() => {
    if (chatId) {
      const chat = chats.find((c) => c.id === chatId);
      if (chat) {
        setCurrentChat(chat);
      }
    }
  }, [chatId, chats, setCurrentChat]);

  useEffect(() => {
    loadAvailableUsers();
  }, []);

  const handleOpenNewChatModal = async () => {
    setShowNewChatModal(true);
    await loadAvailableUsers();
  };

  const handleChatSelect = (chat) => {
    setCurrentChat(chat);
    navigate(`/chats/${chat.id}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const loadAvailableUsers = async () => {
    try {
      const users = await apiService.getUsers();
      setAvailableUsers(users.filter((u) => u.id !== user.id));
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    try {
      const chat = await createChat(newChatData);
      setShowNewChatModal(false);
      setNewChatData({
        name: "",
        chat_type: "direct",
        participants: [],
        description: "",
      });
      handleChatSelect(chat);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  // Search for users
  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Filter from available users or make API call to search users
      const filteredUsers = availableUsers.filter(user =>
        user.username.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error("Failed to search users:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Create a direct chat with selected user
  const handleUserSelect = async (selectedUser) => {
    try {
      // Check if a direct chat already exists with this user
      const existingChat = chats.find(chat => 
        chat.chat_type === "direct" && 
        chat.participants.some(p => p.id === selectedUser.id)
      );

      if (existingChat) {
        // Navigate to existing chat
        handleChatSelect(existingChat);
      } else {
        // Create new direct chat
        const chatData = {
          name: "", // For direct chats, name might be auto-generated
          chat_type: "direct",
          participants: [selectedUser.id],
          description: "",
        };
        
        const newChat = await createChat(chatData);
        handleChatSelect(newChat);
      }
      
      // Reset search
      setShowSearchInput(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  const handleCloseSearch = () => {
    setShowSearchInput(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-800">
                Chat Application
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.username}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat List Sidebar */}
        <div
          className={`${chatId ? "hidden md:block" : "block"} w-full md:w-80`}
        >
          <div className="bg-white h-full flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <FontAwesomeIcon
                    onClick={() => {
                      navigate("/");
                      setCurrentChat(null);
                    }}
                    icon={faHouse}
                    className="cursor-pointer text-gray-600 hover:text-gray-800"
                  />
                  
                  {showSearchInput ? (
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                      <button
                        onClick={handleCloseSearch}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                      
                      {/* Search Results Dropdown */}
                      {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                          {searchResults.map((user) => (
                            <div
                              key={user.id}
                              onClick={() => handleUserSelect(user)}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center space-x-2"
                            >
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm">{user.username}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {isSearching && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-2">
                          <div className="text-sm text-gray-500">Searching...</div>
                        </div>
                      )}
                      
                      {searchQuery && !isSearching && searchResults.length === 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-2">
                          <div className="text-sm text-gray-500">No users found</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <FontAwesomeIcon
                      onClick={() => setShowSearchInput(true)}
                      icon={faMagnifyingGlass}
                      className="cursor-pointer text-gray-600 hover:text-gray-800"
                    />
                  )}
                </div>
                
                <button
                  onClick={handleOpenNewChatModal}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
            <ChatList
              chats={chats}
              currentChat={currentChat}
              onChatSelect={handleChatSelect}
              onlineUsers={onlineUsers}
            />
          </div>
        </div>

        {/* Chat Room */}
        <div className={`flex-1 ${!chatId ? "hidden md:block" : "block"}`}>
          <ChatRoom />
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Create New Chat</h3>
            <form onSubmit={handleCreateChat} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Chat Type
                </label>
                <select
                  value={newChatData.chat_type}
                  onChange={(e) =>
                    setNewChatData({
                      ...newChatData,
                      chat_type: e.target.value,
                    })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="direct">Direct Message</option>
                  <option value="group">Group Chat</option>
                </select>
              </div>

              {newChatData.chat_type === "group" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={newChatData.name}
                    onChange={(e) =>
                      setNewChatData({ ...newChatData, name: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Participants
                </label>
                <select
                  multiple
                  value={newChatData.participants}
                  onChange={(e) =>
                    setNewChatData({
                      ...newChatData,
                      participants: Array.from(
                        e.target.selectedOptions,
                        (option) => option.value
                      ),
                    })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Create Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chats;