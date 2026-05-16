import Foundation

struct Conversation: Codable, Identifiable, Equatable {
    let id: String
    var title: String
    var pinned: Bool
    var createdAt: String
    var updatedAt: String
}

struct ChatMessage: Codable, Identifiable, Equatable {
    let id: String
    let conversationId: String
    let role: String
    var content: String
    var status: String
    let createdAt: String
    var updatedAt: String
    var error: String?
}

struct HealthResponse: Codable, Equatable {
    let status: String
    let service: String
    let modelMode: String
    let timestamp: String
    let version: String
}

struct ConversationsResponse: Codable {
    let conversations: [Conversation]
}

struct CreateConversationRequest: Codable {
    let title: String?
}

struct CreateConversationResponse: Codable {
    let conversation: Conversation
}

struct UpdateConversationRequest: Codable {
    let title: String?
    let pinned: Bool?
}

struct MessagesResponse: Codable {
    let conversation: Conversation
    let messages: [ChatMessage]
}

struct ChatRequest: Codable {
    let conversationId: String?
    let message: String
}

struct ChatResponse: Codable {
    let conversation: Conversation
    let userMessage: ChatMessage
    let assistantMessage: ChatMessage
}

struct StreamConversationEvent: Codable {
    let type: String?
    let conversation: Conversation
}

struct StreamMessageEvent: Codable {
    let type: String?
    let message: ChatMessage
}

struct StreamDeltaEvent: Codable {
    let type: String?
    let messageId: String
    let conversationId: String
    let delta: String
}

struct StreamDoneEvent: Codable {
    let type: String?
    let message: ChatMessage
}

struct StreamErrorEvent: Codable {
    let type: String?
    let messageId: String?
    let conversationId: String?
    let error: String
}

enum ChatStreamEvent {
    case conversation(StreamConversationEvent)
    case message(StreamMessageEvent)
    case delta(StreamDeltaEvent)
    case done(StreamDoneEvent)
    case error(StreamErrorEvent)
}

struct LocalSnapshot: Codable {
    var conversations: [Conversation] = []
    var messagesByConversation: [String: [ChatMessage]] = [:]
    var selectedConversationId: String?
}
