package com.qianwen.demo.ui

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.qianwen.demo.BuildConfig
import com.qianwen.demo.data.ChatMessage
import com.qianwen.demo.data.ChatStreamEvent
import com.qianwen.demo.data.Conversation
import com.qianwen.demo.data.HealthResponse
import com.qianwen.demo.data.LOCAL_SNAPSHOT_VERSION
import com.qianwen.demo.data.LocalSnapshot
import com.qianwen.demo.data.NativeScreen
import com.qianwen.demo.data.QianwenRepository
import com.qianwen.demo.data.QianwenRepositoryContract
import com.qianwen.demo.data.SnapshotReadStatus
import com.qianwen.demo.data.StreamConversationEvent
import com.qianwen.demo.data.StreamDeltaEvent
import com.qianwen.demo.data.StreamDoneEvent
import com.qianwen.demo.data.StreamErrorEvent
import com.qianwen.demo.data.StreamMessageEvent
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class ServiceStatus {
    CHECKING,
    ONLINE,
    OFFLINE
}

enum class ConversationListStatus {
    LOADING,
    READY,
    EMPTY,
    OFFLINE
}

enum class SendStatus {
    IDLE,
    STREAMING,
    FAILED,
    CANCELED
}

enum class CacheStatus {
    EMPTY,
    RESTORED,
    SAVED,
    CORRUPTED
}

data class RetryDraft(
    val conversationId: String,
    val text: String,
    val reason: String
)

data class QianwenUiState(
    val screen: NativeScreen = NativeScreen.Conversations,
    val conversations: List<Conversation> = emptyList(),
    val messagesByConversation: Map<String, List<ChatMessage>> = emptyMap(),
    val selectedConversationId: String? = null,
    val health: HealthResponse? = null,
    val serviceStatus: ServiceStatus = ServiceStatus.CHECKING,
    val listStatus: ConversationListStatus = ConversationListStatus.LOADING,
    val sendStatus: SendStatus = SendStatus.IDLE,
    val cacheStatus: CacheStatus = CacheStatus.EMPTY,
    val retryDraft: RetryDraft? = null,
    val draft: String = "",
    val error: String? = null,
    val notice: String? = null,
    val searchQuery: String = "",
    val lastHealthCheckedAt: String? = null,
    val lastCacheSavedAt: String? = null,
    val apiBaseUrl: String = BuildConfig.QWEN_API_BASE_URL
) {
    val isStreaming: Boolean
        get() = sendStatus == SendStatus.STREAMING
}

class QianwenViewModel(
    private val repository: QianwenRepositoryContract,
    private val configuredApiBaseUrl: String = BuildConfig.QWEN_API_BASE_URL
) : ViewModel() {
    private val _state = MutableStateFlow(QianwenUiState(apiBaseUrl = configuredApiBaseUrl))
    val state: StateFlow<QianwenUiState> = _state
    private var sendJob: Job? = null

    init {
        viewModelScope.launch {
            restoreLocalSnapshot()
            refreshHealth()
            refreshConversations()
        }
    }

    fun navigate(screen: NativeScreen) {
        _state.update { it.copy(screen = screen, error = null) }
        if (screen is NativeScreen.Chat) {
            selectConversation(screen.conversationId, screen.title)
        }
    }

    fun refreshHealth(showFeedback: Boolean = false) {
        viewModelScope.launch {
            _state.update { it.copy(serviceStatus = ServiceStatus.CHECKING) }
            runCatching { repository.health() }
                .onSuccess { health ->
                    _state.update {
                        it.copy(
                            health = health,
                            serviceStatus = ServiceStatus.ONLINE,
                            lastHealthCheckedAt = Instant.now().toString(),
                            error = null,
                            notice = if (showFeedback) "服务端在线：${health.modelMode}" else it.notice
                        )
                    }
                }
                .onFailure {
                    _state.update {
                        it.copy(
                            serviceStatus = ServiceStatus.OFFLINE,
                            lastHealthCheckedAt = Instant.now().toString(),
                            error = "服务端健康检查失败，当前可继续查看本地缓存。",
                            notice = if (showFeedback) "服务端状态刷新失败。" else it.notice
                        )
                    }
                }
        }
    }

    fun showNotice(message: String) {
        _state.update { it.copy(notice = message) }
    }

    fun clearNotice() {
        _state.update { it.copy(notice = null) }
    }

    fun refreshConversations() {
        viewModelScope.launch {
            _state.update { it.copy(listStatus = ConversationListStatus.LOADING) }
            runCatching { repository.listConversations() }
                .onSuccess { remoteConversations ->
                    _state.update { current ->
                        val conversations = mergeConversations(remoteConversations, current.conversations)
                        val selectedConversationId = current.selectedConversationId ?: conversations.firstOrNull()?.id
                        current.copy(
                            conversations = conversations,
                            selectedConversationId = selectedConversationId,
                            screen = syncScreenTitle(current.screen, conversations),
                            listStatus = conversations.toListStatus(),
                            error = null
                        )
                    }
                    persistSafely()
                }
                .onFailure {
                    _state.update { current ->
                        current.copy(
                            listStatus = if (current.conversations.isEmpty()) {
                                ConversationListStatus.OFFLINE
                            } else {
                                ConversationListStatus.READY
                            },
                            serviceStatus = ServiceStatus.OFFLINE,
                            error = "无法连接服务端，已保留本地会话与消息。"
                        )
                    }
                }
        }
    }

    fun createConversation() {
        viewModelScope.launch {
            _state.update { it.copy(listStatus = ConversationListStatus.LOADING) }
            runCatching { repository.createConversation("Android 会话") }
                .onSuccess { conversation ->
                    _state.update {
                        it.copy(
                            screen = NativeScreen.Chat(conversation.id, conversation.title),
                            conversations = it.conversations.upsert(conversation).sorted(),
                            selectedConversationId = conversation.id,
                            listStatus = ConversationListStatus.READY,
                            draft = "",
                            retryDraft = null,
                            sendStatus = SendStatus.IDLE,
                            error = null,
                            notice = "已新建会话。"
                        )
                    }
                    persistSafely()
                }
                .onFailure {
                    _state.update {
                        it.copy(
                            listStatus = it.conversations.toListStatus(),
                            error = "新建会话失败，请确认服务端已启动。"
                        )
                    }
                }
        }
    }

    fun updateSearchQuery(query: String) {
        _state.update { it.copy(searchQuery = query) }
    }

    fun updateDraft(text: String) {
        _state.update {
            it.copy(
                draft = text,
                retryDraft = if (it.retryDraft?.text == text.trim()) it.retryDraft else null,
                sendStatus = if (it.sendStatus == SendStatus.FAILED || it.sendStatus == SendStatus.CANCELED) {
                    SendStatus.IDLE
                } else {
                    it.sendStatus
                },
                error = if (it.sendStatus == SendStatus.FAILED || it.sendStatus == SendStatus.CANCELED) null else it.error
            )
        }
    }

    fun applyComposerTemplate(template: String) {
        val nextTemplate = template.trim()
        if (nextTemplate.isEmpty()) {
            return
        }

        _state.update { current ->
            val currentDraft = current.draft.trimEnd()
            val nextDraft = if (currentDraft.isBlank()) {
                nextTemplate
            } else {
                "$currentDraft\n$nextTemplate"
            }

            current.copy(
                draft = nextDraft,
                retryDraft = null,
                sendStatus = if (current.isStreaming) current.sendStatus else SendStatus.IDLE,
                error = null,
                notice = "已插入快捷提示。"
            )
        }
    }

    fun useMessageAsDraft(content: String) {
        val nextDraft = content.trim()
        if (nextDraft.isEmpty()) {
            showNotice("这条回复没有可编辑内容。")
            return
        }

        _state.update {
            it.copy(
                draft = nextDraft,
                retryDraft = null,
                sendStatus = if (it.isStreaming) it.sendStatus else SendStatus.IDLE,
                error = null,
                notice = "回复内容已放入输入框。"
            )
        }
    }

    fun renameConversation(conversationId: String, title: String) {
        val nextTitle = title.trim()
        if (nextTitle.isEmpty()) {
            return
        }

        viewModelScope.launch {
            runCatching { repository.updateConversation(conversationId, title = nextTitle) }
                .onSuccess { conversation ->
                    _state.update {
                        it.copy(
                            conversations = it.conversations.upsert(conversation).sorted(),
                            screen = syncScreenTitle(it.screen, listOf(conversation)),
                            error = null,
                            notice = "会话已重命名。"
                        )
                    }
                    persistSafely()
                }
                .onFailure { _state.update { it.copy(error = "重命名失败，请稍后重试。") } }
        }
    }

    fun togglePinned(conversation: Conversation) {
        viewModelScope.launch {
            runCatching { repository.updateConversation(conversation.id, pinned = !conversation.pinned) }
                .onSuccess { updated ->
                    _state.update {
                        it.copy(
                            conversations = it.conversations.upsert(updated).sorted(),
                            error = null,
                            notice = if (updated.pinned) "会话已置顶。" else "已取消置顶。"
                        )
                    }
                    persistSafely()
                }
                .onFailure { _state.update { it.copy(error = "置顶状态同步失败。") } }
        }
    }

    fun deleteConversation(conversationId: String) {
        if (_state.value.selectedConversationId == conversationId && _state.value.isStreaming) {
            cancelSending()
        }

        viewModelScope.launch {
            runCatching { repository.deleteConversation(conversationId) }
                .onSuccess { remoteConversations ->
                    _state.update { current ->
                        val nextMessages = current.messagesByConversation - conversationId
                        val nextConversations = remoteConversations.sorted()
                        val nextSelected =
                            if (current.selectedConversationId == conversationId) {
                                nextConversations.firstOrNull()?.id
                            } else {
                                current.selectedConversationId
                            }
                        current.copy(
                            screen = NativeScreen.Conversations,
                            conversations = nextConversations,
                            messagesByConversation = nextMessages,
                            selectedConversationId = nextSelected,
                            listStatus = nextConversations.toListStatus(),
                            retryDraft = current.retryDraft?.takeIf { it.conversationId != conversationId },
                            error = null,
                            notice = "会话已删除。"
                        )
                    }
                    persistSafely()
                }
                .onFailure { _state.update { it.copy(error = "删除会话失败，请稍后重试。") } }
        }
    }

    fun selectConversation(conversationId: String, title: String) {
        _state.update {
            val isSameConversation = it.selectedConversationId == conversationId
            it.copy(
                screen = NativeScreen.Chat(conversationId, title),
                selectedConversationId = conversationId,
                draft = if (isSameConversation) it.draft else "",
                retryDraft = if (isSameConversation) it.retryDraft else null,
                sendStatus = if (isSameConversation) it.sendStatus else SendStatus.IDLE,
                error = null
            )
        }
        viewModelScope.launch {
            runCatching { repository.getMessages(conversationId) }
                .onSuccess { messages ->
                    _state.update {
                        it.copy(messagesByConversation = it.messagesByConversation + (conversationId to messages), error = null)
                    }
                    persistSafely()
                }
                .onFailure { _state.update { it.copy(error = "消息加载失败，已展示本地缓存。") } }
        }
    }

    fun sendMessage(text: String = _state.value.draft) {
        val prompt = text.trim()
        val conversationId = _state.value.selectedConversationId
        if (prompt.isEmpty() || conversationId == null || _state.value.isStreaming) {
            return
        }

        sendJob = viewModelScope.launch {
            _state.update {
                it.copy(
                    draft = prompt,
                    sendStatus = SendStatus.STREAMING,
                    retryDraft = null,
                    error = null,
                    notice = null
                )
            }

            try {
                repository.streamChat(conversationId, prompt) { event ->
                    _state.update { current ->
                        applyStreamEvent(current, conversationId, event)
                    }
                }

                if (_state.value.sendStatus == SendStatus.FAILED) {
                    persistSafely()
                    return@launch
                }

                _state.update {
                    it.copy(
                        draft = "",
                        sendStatus = SendStatus.IDLE,
                        retryDraft = null,
                        error = null,
                        notice = "回复已完成。"
                    )
                }
                persistSafely()
            } catch (error: CancellationException) {
                _state.update {
                    it.copy(
                        draft = prompt,
                        sendStatus = SendStatus.CANCELED,
                        retryDraft = RetryDraft(conversationId, prompt, "用户取消了本次生成。"),
                        error = "已取消本次生成，可继续编辑后重新发送。",
                        notice = "已取消生成。"
                    )
                }
                persistSafely()
            } catch (error: Throwable) {
                val message = error.message ?: "未知网络错误"
                _state.update {
                    it.copy(
                        draft = prompt,
                        sendStatus = SendStatus.FAILED,
                        retryDraft = RetryDraft(conversationId, prompt, message),
                        error = "发送失败：$message",
                        notice = "发送失败，可点击重试。"
                    )
                }
                persistSafely()
            } finally {
                sendJob = null
            }
        }
    }

    fun retryLastMessage() {
        val retry = _state.value.retryDraft ?: return
        _state.update {
            it.copy(
                selectedConversationId = retry.conversationId,
                draft = retry.text,
                error = null,
                notice = "正在重试上一条消息。"
            )
        }
        sendMessage(retry.text)
    }

    fun regenerateFromMessage(message: ChatMessage) {
        if (_state.value.isStreaming) {
            showNotice("生成中不可重新生成，请先取消。")
            return
        }

        val messages = _state.value.messagesByConversation[message.conversationId].orEmpty()
        val messageIndex = messages.indexOfFirst { it.id == message.id }
        val prompt = messages
            .take(if (messageIndex < 0) messages.size else messageIndex)
            .lastOrNull { it.role == "user" }
            ?.content
            ?.trim()

        if (prompt.isNullOrEmpty()) {
            showNotice("没有找到可重新生成的上一条问题。")
            return
        }

        _state.update {
            it.copy(
                selectedConversationId = message.conversationId,
                draft = prompt,
                retryDraft = null,
                error = null,
                notice = "正在重新生成回复。"
            )
        }
        sendMessage(prompt)
    }

    fun cancelSending() {
        val current = _state.value
        val conversationId = current.selectedConversationId ?: return
        val prompt = current.draft.trim()
        _state.update {
            it.copy(
                sendStatus = SendStatus.CANCELED,
                retryDraft = if (prompt.isNotEmpty()) RetryDraft(conversationId, prompt, "用户取消了本次生成。") else it.retryDraft,
                error = "已取消本次生成，可继续编辑后重新发送。",
                notice = "已取消生成。"
            )
        }
        sendJob?.cancel(CancellationException("用户取消流式回复"))
    }

    fun clearMessages() {
        val conversationId = _state.value.selectedConversationId
        if (conversationId == null) {
            showNotice("请先选择会话。")
            return
        }
        if (_state.value.isStreaming) {
            showNotice("生成中不可清空，请先取消。")
            return
        }

        viewModelScope.launch {
            runCatching { repository.clearMessages(conversationId) }
                .onSuccess { messages ->
                    _state.update {
                        it.copy(
                            messagesByConversation = it.messagesByConversation + (conversationId to messages),
                            error = null,
                            notice = "会话已清空。"
                        )
                    }
                    persistSafely()
                }
                .onFailure { _state.update { it.copy(error = "清空失败，请稍后重试。") } }
        }
    }

    private suspend fun restoreLocalSnapshot() {
        val result = repository.readSnapshot()
        val snapshot = result.snapshot
        val conversations = snapshot.conversations.sorted()
        val selectedConversationId = snapshot.selectedConversationId
            ?.takeIf { id -> conversations.any { it.id == id } }
        val restoredScreen = selectedConversationId
            ?.let { id -> conversations.firstOrNull { it.id == id }?.let { NativeScreen.Chat(id, it.title) } }
            ?: NativeScreen.Conversations

        _state.update {
            it.copy(
                screen = restoredScreen,
                conversations = conversations,
                messagesByConversation = snapshot.messagesByConversation,
                selectedConversationId = selectedConversationId,
                listStatus = if (conversations.isEmpty()) ConversationListStatus.LOADING else ConversationListStatus.READY,
                cacheStatus = result.status.toCacheStatus(),
                lastCacheSavedAt = snapshot.savedAt,
                error = if (result.status == SnapshotReadStatus.Corrupted) {
                    "本地缓存解析失败，已使用空状态继续。"
                } else {
                    it.error
                }
            )
        }
    }

    private suspend fun persistSafely() {
        runCatching { persist() }
            .onFailure {
                _state.update { current ->
                    current.copy(
                        cacheStatus = CacheStatus.CORRUPTED,
                        error = "本地缓存写入失败，远端会话不受影响。"
                    )
                }
            }
    }

    private suspend fun persist() {
        val current = _state.value
        val savedAt = Instant.now().toString()
        repository.writeSnapshot(
            LocalSnapshot(
                version = LOCAL_SNAPSHOT_VERSION,
                savedAt = savedAt,
                conversations = current.conversations,
                messagesByConversation = current.messagesByConversation,
                selectedConversationId = current.selectedConversationId
            )
        )
        _state.update {
            it.copy(
                cacheStatus = CacheStatus.SAVED,
                lastCacheSavedAt = savedAt
            )
        }
    }

    companion object {
        fun factory(application: Application): ViewModelProvider.Factory {
            return object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    if (modelClass.isAssignableFrom(QianwenViewModel::class.java)) {
                        return QianwenViewModel(QianwenRepository(application)) as T
                    }
                    error("Unknown ViewModel: ${modelClass.name}")
                }
            }
        }
    }
}

private fun SnapshotReadStatus.toCacheStatus(): CacheStatus {
    return when (this) {
        SnapshotReadStatus.Empty -> CacheStatus.EMPTY
        SnapshotReadStatus.Restored -> CacheStatus.RESTORED
        SnapshotReadStatus.Corrupted -> CacheStatus.CORRUPTED
    }
}

private fun List<Conversation>.toListStatus(): ConversationListStatus {
    return if (isEmpty()) ConversationListStatus.EMPTY else ConversationListStatus.READY
}

private fun List<Conversation>.sorted(): List<Conversation> {
    return sortedWith(compareByDescending<Conversation> { it.pinned }.thenByDescending { it.updatedAt })
}

private fun List<Conversation>.upsert(conversation: Conversation): List<Conversation> {
    return listOf(conversation) + filterNot { it.id == conversation.id }
}

private fun List<ChatMessage>.upsert(message: ChatMessage): List<ChatMessage> {
    return this.filterNot { it.id == message.id } + message
}

private fun mergeConversations(
    remoteConversations: List<Conversation>,
    cachedConversations: List<Conversation>
): List<Conversation> {
    return (remoteConversations + cachedConversations).distinctBy { it.id }.sorted()
}

private fun syncScreenTitle(screen: NativeScreen, conversations: List<Conversation>): NativeScreen {
    if (screen !is NativeScreen.Chat) {
        return screen
    }

    val conversation = conversations.firstOrNull { it.id == screen.conversationId } ?: return screen
    return NativeScreen.Chat(conversation.id, conversation.title)
}

private fun applyStreamEvent(
    state: QianwenUiState,
    requestedConversationId: String,
    event: ChatStreamEvent
): QianwenUiState {
    return when (event) {
        is StreamConversationEvent -> {
            state.copy(
                conversations = state.conversations.upsert(event.conversation).sorted(),
                selectedConversationId = event.conversation.id,
                screen = syncScreenTitle(state.screen, listOf(event.conversation))
            )
        }

        is StreamMessageEvent -> {
            val conversationId = event.message.conversationId
            val messages = state.messagesByConversation[conversationId].orEmpty().upsert(event.message)
            state.copy(messagesByConversation = state.messagesByConversation + (conversationId to messages))
        }

        is StreamDeltaEvent -> {
            val conversationId = event.conversationId
            val messages = state.messagesByConversation[conversationId].orEmpty().map { message ->
                if (message.id == event.messageId) {
                    message.copy(content = message.content + event.delta, status = "streaming")
                } else {
                    message
                }
            }
            state.copy(messagesByConversation = state.messagesByConversation + (conversationId to messages))
        }

        is StreamDoneEvent -> {
            val conversationId = event.message.conversationId
            val messages = state.messagesByConversation[conversationId].orEmpty().upsert(event.message)
            state.copy(messagesByConversation = state.messagesByConversation + (conversationId to messages))
        }

        is StreamErrorEvent -> {
            val conversationId = event.conversationId ?: requestedConversationId
            val messages = state.messagesByConversation[conversationId].orEmpty().map { message ->
                if (message.id == event.messageId) {
                    message.copy(status = "error", error = event.error)
                } else {
                    message
                }
            }
            state.copy(
                messagesByConversation = state.messagesByConversation + (conversationId to messages),
                sendStatus = SendStatus.FAILED,
                retryDraft = RetryDraft(conversationId, state.draft, event.error),
                error = event.error,
                notice = "流式回复失败，可点击重试。"
            )
        }
    }
}
