package com.qianwen.demo.ui

import com.qianwen.demo.data.ChatMessage
import com.qianwen.demo.data.ChatResponse
import com.qianwen.demo.data.ChatStreamEvent
import com.qianwen.demo.data.Conversation
import com.qianwen.demo.data.HealthResponse
import com.qianwen.demo.data.LocalSnapshot
import com.qianwen.demo.data.LocalSnapshotResult
import com.qianwen.demo.data.QianwenRepositoryContract
import com.qianwen.demo.data.SnapshotReadStatus
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description

@OptIn(ExperimentalCoroutinesApi::class)
class QianwenViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun restoresCachedConversationWhenServerIsOffline() = runTest {
        val conversation = sampleConversation()
        val repository = FakeRepository(
            snapshotResult = LocalSnapshotResult(
                LocalSnapshot(
                    savedAt = "2026-05-14T00:00:00Z",
                    conversations = listOf(conversation),
                    messagesByConversation = mapOf(conversation.id to listOf(sampleMessage(conversation.id))),
                    selectedConversationId = conversation.id
                ),
                SnapshotReadStatus.Restored
            ),
            healthFailure = IllegalStateException("offline"),
            listFailure = IllegalStateException("offline")
        )

        val viewModel = QianwenViewModel(repository, "http://test")
        advanceUntilIdle()

        val state = viewModel.state.value
        assertEquals(CacheStatus.RESTORED, state.cacheStatus)
        assertEquals(ServiceStatus.OFFLINE, state.serviceStatus)
        assertEquals(ConversationListStatus.READY, state.listStatus)
        assertEquals(conversation.id, state.selectedConversationId)
        assertEquals(1, state.messagesByConversation[conversation.id]?.size)
    }

    @Test
    fun sendFailureKeepsDraftAndCreatesRetryEntry() = runTest {
        val conversation = sampleConversation()
        val repository = FakeRepository(
            snapshotResult = snapshotWithConversation(conversation),
            listConversations = listOf(conversation),
            streamFailure = IllegalStateException("network down")
        )
        val viewModel = QianwenViewModel(repository, "http://test")
        advanceUntilIdle()

        viewModel.updateDraft("  你好千问  ")
        viewModel.sendMessage()
        advanceUntilIdle()

        val state = viewModel.state.value
        assertEquals(SendStatus.FAILED, state.sendStatus)
        assertEquals("你好千问", state.draft)
        assertEquals("你好千问", state.retryDraft?.text)
        assertEquals(1, repository.streamCalls)
    }

    @Test
    fun streamingRequestAvoidsDuplicateAndCanBeCanceled() = runTest {
        val conversation = sampleConversation()
        val repository = FakeRepository(
            snapshotResult = snapshotWithConversation(conversation),
            listConversations = listOf(conversation),
            streamBlock = { awaitCancellation() }
        )
        val viewModel = QianwenViewModel(repository, "http://test")
        advanceUntilIdle()

        viewModel.updateDraft("慢一点回答")
        viewModel.sendMessage()
        advanceUntilIdle()
        viewModel.sendMessage()

        assertEquals(1, repository.streamCalls)

        viewModel.cancelSending()
        advanceUntilIdle()

        val state = viewModel.state.value
        assertEquals(SendStatus.CANCELED, state.sendStatus)
        assertNotNull(state.retryDraft)
        assertEquals("慢一点回答", state.draft)
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(
    private val dispatcher: TestDispatcher = UnconfinedTestDispatcher()
) : TestWatcher() {
    override fun starting(description: Description) {
        Dispatchers.setMain(dispatcher)
    }

    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}

private class FakeRepository(
    private val snapshotResult: LocalSnapshotResult = LocalSnapshotResult(LocalSnapshot(), SnapshotReadStatus.Empty),
    private val listConversations: List<Conversation> = snapshotResult.snapshot.conversations,
    private val healthFailure: Throwable? = null,
    private val listFailure: Throwable? = null,
    private val streamFailure: Throwable? = null,
    private val streamBlock: (suspend () -> Unit)? = null
) : QianwenRepositoryContract {
    var streamCalls = 0
    var lastSnapshot: LocalSnapshot? = null

    override suspend fun health(): HealthResponse {
        healthFailure?.let { throw it }
        return HealthResponse(
            status = "ok",
            service = "qianwen-demo-server",
            modelMode = "mock",
            timestamp = Instant.now().toString(),
            version = "0.1.0"
        )
    }

    override suspend fun listConversations(): List<Conversation> {
        listFailure?.let { throw it }
        return listConversations
    }

    override suspend fun createConversation(title: String): Conversation {
        return sampleConversation(title = title)
    }

    override suspend fun updateConversation(conversationId: String, title: String?, pinned: Boolean?): Conversation {
        val source = listConversations.firstOrNull { it.id == conversationId } ?: sampleConversation(conversationId)
        return source.copy(
            title = title ?: source.title,
            pinned = pinned ?: source.pinned
        )
    }

    override suspend fun deleteConversation(conversationId: String): List<Conversation> {
        return listConversations.filterNot { it.id == conversationId }
    }

    override suspend fun getMessages(conversationId: String): List<ChatMessage> {
        return snapshotResult.snapshot.messagesByConversation[conversationId].orEmpty()
    }

    override suspend fun clearMessages(conversationId: String): List<ChatMessage> {
        return emptyList()
    }

    override suspend fun chat(conversationId: String, message: String): ChatResponse {
        val userMessage = sampleMessage(conversationId, role = "user", content = message)
        val assistantMessage = sampleMessage(conversationId, role = "assistant", content = "ok")
        return ChatResponse(sampleConversation(conversationId), userMessage, assistantMessage)
    }

    override suspend fun streamChat(
        conversationId: String,
        message: String,
        onEvent: suspend (ChatStreamEvent) -> Unit
    ) {
        streamCalls += 1
        streamFailure?.let { throw it }
        streamBlock?.invoke()
    }

    override suspend fun readSnapshot(): LocalSnapshotResult = snapshotResult

    override suspend fun writeSnapshot(snapshot: LocalSnapshot) {
        lastSnapshot = snapshot
    }
}

private fun snapshotWithConversation(conversation: Conversation): LocalSnapshotResult {
    return LocalSnapshotResult(
        LocalSnapshot(
            conversations = listOf(conversation),
            selectedConversationId = conversation.id
        ),
        SnapshotReadStatus.Restored
    )
}

private fun sampleConversation(id: String = "c-1", title: String = "Android 面试会话"): Conversation {
    return Conversation(
        id = id,
        title = title,
        pinned = false,
        createdAt = "2026-05-14T00:00:00.000Z",
        updatedAt = "2026-05-14T00:00:00.000Z"
    )
}

private fun sampleMessage(
    conversationId: String,
    role: String = "assistant",
    content: String = "cached"
): ChatMessage {
    return ChatMessage(
        id = "m-$role",
        conversationId = conversationId,
        role = role,
        content = content,
        status = "sent",
        createdAt = "2026-05-14T00:00:00.000Z",
        updatedAt = "2026-05-14T00:00:00.000Z"
    )
}
