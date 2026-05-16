package com.qianwen.demo.data

import kotlinx.serialization.Serializable

const val LOCAL_SNAPSHOT_VERSION = 1

@Serializable
data class Conversation(
    val id: String,
    val title: String,
    val pinned: Boolean,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class ChatMessage(
    val id: String,
    val conversationId: String,
    val role: String,
    val content: String,
    val status: String,
    val createdAt: String,
    val updatedAt: String,
    val error: String? = null
)

@Serializable
data class HealthResponse(
    val status: String,
    val service: String,
    val modelMode: String,
    val timestamp: String,
    val version: String
)

@Serializable
data class ConversationsResponse(val conversations: List<Conversation>)

@Serializable
data class CreateConversationRequest(val title: String? = null)

@Serializable
data class CreateConversationResponse(val conversation: Conversation)

@Serializable
data class UpdateConversationRequest(
    val title: String? = null,
    val pinned: Boolean? = null
)

@Serializable
data class MessagesResponse(
    val conversation: Conversation,
    val messages: List<ChatMessage>
)

@Serializable
data class ChatRequest(
    val conversationId: String? = null,
    val message: String
)

@Serializable
data class ChatResponse(
    val conversation: Conversation,
    val userMessage: ChatMessage,
    val assistantMessage: ChatMessage
)

sealed interface ChatStreamEvent {
    val type: String
}

@Serializable
data class StreamConversationEvent(
    override val type: String = "conversation",
    val conversation: Conversation
) : ChatStreamEvent

@Serializable
data class StreamMessageEvent(
    override val type: String = "message",
    val message: ChatMessage
) : ChatStreamEvent

@Serializable
data class StreamDeltaEvent(
    override val type: String = "delta",
    val messageId: String,
    val conversationId: String,
    val delta: String
) : ChatStreamEvent

@Serializable
data class StreamDoneEvent(
    override val type: String = "done",
    val message: ChatMessage
) : ChatStreamEvent

@Serializable
data class StreamErrorEvent(
    override val type: String = "error",
    val messageId: String? = null,
    val conversationId: String? = null,
    val error: String
) : ChatStreamEvent

@Serializable
data class LocalSnapshot(
    val version: Int = LOCAL_SNAPSHOT_VERSION,
    val savedAt: String? = null,
    val conversations: List<Conversation> = emptyList(),
    val messagesByConversation: Map<String, List<ChatMessage>> = emptyMap(),
    val selectedConversationId: String? = null
)

data class LocalSnapshotResult(
    val snapshot: LocalSnapshot,
    val status: SnapshotReadStatus
)

enum class SnapshotReadStatus {
    Empty,
    Restored,
    Corrupted
}

sealed interface NativeScreen {
    data object Conversations : NativeScreen
    data class Chat(val conversationId: String, val title: String) : NativeScreen
    data object Status : NativeScreen
    data object Settings : NativeScreen
}
