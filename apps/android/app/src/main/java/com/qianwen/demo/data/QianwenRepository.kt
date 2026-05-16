package com.qianwen.demo.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.qianwen.demo.BuildConfig
import kotlinx.coroutines.flow.first
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val Context.qianwenDataStore by preferencesDataStore(name = "qianwen_native_store")

interface QianwenRepositoryContract {
    suspend fun health(): HealthResponse

    suspend fun listConversations(): List<Conversation>

    suspend fun createConversation(title: String): Conversation

    suspend fun updateConversation(conversationId: String, title: String? = null, pinned: Boolean? = null): Conversation

    suspend fun deleteConversation(conversationId: String): List<Conversation>

    suspend fun getMessages(conversationId: String): List<ChatMessage>

    suspend fun clearMessages(conversationId: String): List<ChatMessage>

    suspend fun chat(conversationId: String, message: String): ChatResponse

    suspend fun streamChat(
        conversationId: String,
        message: String,
        onEvent: suspend (ChatStreamEvent) -> Unit
    )

    suspend fun readSnapshot(): LocalSnapshotResult

    suspend fun writeSnapshot(snapshot: LocalSnapshot)
}

class QianwenRepository(
    private val context: Context,
    private val api: QianwenApiClient = QianwenApiClient(BuildConfig.QWEN_API_BASE_URL),
    private val json: Json = Json { ignoreUnknownKeys = true }
) : QianwenRepositoryContract {
    private val snapshotKey = stringPreferencesKey("snapshot")

    override suspend fun health() = api.health()

    override suspend fun listConversations() = api.listConversations().conversations

    override suspend fun createConversation(title: String) = api.createConversation(title).conversation

    override suspend fun updateConversation(conversationId: String, title: String?, pinned: Boolean?) =
        api.updateConversation(conversationId, title, pinned).conversation

    override suspend fun deleteConversation(conversationId: String) = api.deleteConversation(conversationId).conversations

    override suspend fun getMessages(conversationId: String) = api.getMessages(conversationId).messages

    override suspend fun clearMessages(conversationId: String) = api.clearMessages(conversationId).messages

    override suspend fun chat(conversationId: String, message: String) = api.chat(conversationId, message)

    override suspend fun streamChat(
        conversationId: String,
        message: String,
        onEvent: suspend (ChatStreamEvent) -> Unit
    ) = api.streamChat(conversationId, message, onEvent)

    override suspend fun readSnapshot(): LocalSnapshotResult {
        val stored = context.qianwenDataStore.data.first()[snapshotKey]
            ?: return LocalSnapshotResult(LocalSnapshot(), SnapshotReadStatus.Empty)

        return runCatching {
            LocalSnapshotResult(json.decodeFromString<LocalSnapshot>(stored), SnapshotReadStatus.Restored)
        }.getOrDefault(LocalSnapshotResult(LocalSnapshot(), SnapshotReadStatus.Corrupted))
    }

    override suspend fun writeSnapshot(snapshot: LocalSnapshot) {
        context.qianwenDataStore.edit { preferences ->
            preferences[snapshotKey] = json.encodeToString(snapshot)
        }
    }
}
