import React from "react";
import { useState } from "react";
import { format } from "date-fns";
import Cookies from "js-cookie";

const ChatList = ({ chats, currentChat, onChatSelect, onlineUsers }) => {
  const user_name = JSON.parse(Cookies.get("user"))?.username;
  const [loggedInUser, setLoggedInUser] = useState(user_name);

  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Chats</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
              currentChat?.id === chat.id
                ? "bg-blue-50 border-r-2 border-blue-500"
                : ""
            }`}
            onClick={() => onChatSelect(chat)}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-800">
                {/* {chat.chat_type === 'direct' 
                  ? chat.participants.find(p => p !== chat.created_by)?.username || 'Unknown User'
                  : chat.name
                } */}
                {chat.chat_type === "direct"
                  ? chat.participant_usernames
                      .find(
                        (p) =>
                          !p.includes(
                            loggedInUser || chat?.last_message?.sender_username
                          )
                      )
                      ?.split("||||")[1] || "Unknown User"
                  : chat.name}
              </h3>
              {chat.last_message && (
                <span className="text-xs text-gray-500">
                  {format(new Date(chat.last_message.created_at), "HH:mm")}
                </span>
              )}
            </div>

            {chat.last_message && (
              <p className="text-sm text-gray-600 truncate">
                {chat.last_message.content}
              </p>
            )}

            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500 capitalize">
                {chat.chat_type}
              </span>
              {onlineUsers.has(
                chat.participants.find((p) => p !== chat.created_by)?.id
              ) && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatList;
