import React from "react";
import { Download, Image, FileText, File, Play } from "lucide-react";

const ChatMessage = ({ message, currentUserId }) => {
  const isOwnMessage = message.sender_id === currentUserId;

  // Get file icon based on file type
  const getFileIcon = (fileType) => {
    if (!fileType) return <File size={20} />;

    if (fileType.startsWith("image/")) {
      return <Image size={20} />;
    } else if (fileType.includes("pdf")) {
      return <FileText size={20} />;
    } else if (fileType.startsWith("video/")) {
      return <Play size={20} />;
    } else {
      return <File size={20} />;
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle file download
  const handleDownload = () => {
    if (message.file_path) {
      // Create a temporary link to download the file
      const link = document.createElement("a");
      link.href = message.file_path;
      link.download = message.file_name || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle image preview
  const handleImageClick = () => {
    if (message.file_type?.startsWith("image/")) {
      window.open(message.file_path, "_blank");
    }
  };

  // Render file message
  if (message.message_type === "file") {
    return (
      <div
        className={`flex ${
          isOwnMessage ? "justify-end" : "justify-start"
        } mb-4`}
      >
        <div
          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
            isOwnMessage
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-900 border border-gray-200"
          }`}
        >
          {/* File Preview for Images */}
          {message.file_type?.startsWith("image/") && (
            <div className="mb-3 rounded overflow-hidden">
              <img
                src={message.file_path}
                alt={message.file_name || "Image"}
                className="max-w-full h-auto max-h-48 object-cover cursor-pointer"
                onClick={handleImageClick}
              />
            </div>
          )}

          {/* File Info */}
          <div className="flex items-start space-x-3">
            <div
              className={`flex-shrink-0 ${
                isOwnMessage ? "text-blue-200" : "text-gray-500"
              }`}
            >
              {getFileIcon(message.file_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  isOwnMessage ? "text-white" : "text-gray-900"
                }`}
              >
                {message.file_name || "File"}
              </p>
              <p
                className={`text-xs ${
                  isOwnMessage ? "text-blue-200" : "text-gray-500"
                }`}
              >
                {formatFileSize(message.file_size)}
              </p>

              {/* Caption */}
              {message.content && (
                <p
                  className={`text-sm mt-2 ${
                    isOwnMessage ? "text-white" : "text-gray-700"
                  }`}
                >
                  {message.content}
                </p>
              )}
            </div>
            <button
              onClick={handleDownload}
              className={`flex-shrink-0 p-1 rounded ${
                isOwnMessage
                  ? "text-blue-200 hover:text-white hover:bg-blue-700"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
              title="Download file"
            >
              <Download size={16} />
            </button>
          </div>

          {/* Timestamp */}
          <p
            className={`text-xs mt-2 ${
              isOwnMessage ? "text-blue-200" : "text-gray-500"
            }`}
          >
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    );
  }

  // Render text message
  return (
    <div
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwnMessage
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-900 border border-gray-200"
        }`}
      >
        <p className="text-sm">{message.content}</p>
        <p
          className={`text-xs mt-1 ${
            isOwnMessage ? "text-blue-200" : "text-gray-500"
          }`}
        >
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
