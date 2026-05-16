package com.qianwen.demo.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@OptIn(ExperimentalSerializationApi::class)
class QianwenApiClient(
    private val baseUrl: String,
    private val client: OkHttpClient = OkHttpClient(),
    private val json: Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }
) {
    private val contentType = "application/json; charset=utf-8".toMediaType()

    suspend fun health(): HealthResponse = get("/health")

    suspend fun listConversations(): ConversationsResponse = get("/conversations")

    suspend fun createConversation(title: String): CreateConversationResponse {
        return post("/conversations", CreateConversationRequest(title))
    }

    suspend fun updateConversation(
        conversationId: String,
        title: String? = null,
        pinned: Boolean? = null
    ): CreateConversationResponse {
        return patch("/conversations/$conversationId", UpdateConversationRequest(title, pinned))
    }

    suspend fun deleteConversation(conversationId: String): ConversationsResponse {
        return delete("/conversations/$conversationId")
    }

    suspend fun getMessages(conversationId: String): MessagesResponse {
        return get("/conversations/$conversationId/messages")
    }

    suspend fun clearMessages(conversationId: String): MessagesResponse {
        return delete("/conversations/$conversationId/messages")
    }

    suspend fun chat(conversationId: String, message: String): ChatResponse {
        return post("/chat", ChatRequest(conversationId, message))
    }

    suspend fun streamChat(
        conversationId: String,
        message: String,
        onEvent: suspend (ChatStreamEvent) -> Unit
    ) {
        val request = Request.Builder()
            .url("$baseUrl/chat/stream")
            .header("accept", "text/event-stream")
            .post(json.encodeToString(ChatRequest(conversationId, message)).toRequestBody(contentType))
            .build()
        val call = client.newCall(request)

        withContext(Dispatchers.IO) {
            val cancellationHandle = currentCoroutineContext()[Job]?.invokeOnCompletion { cause ->
                if (cause is CancellationException) {
                    call.cancel()
                }
            }

            try {
                call.execute().use { httpResponse ->
                    if (!httpResponse.isSuccessful) {
                        val detail = httpResponse.body?.string().orEmpty()
                        error("HTTP ${httpResponse.code}: $detail")
                    }

                    val source = httpResponse.body?.source() ?: error("Empty stream response body")
                    val parser = ChatSseParser(json)
                    var terminalReceived = false
                    while (!terminalReceived) {
                        currentCoroutineContext().ensureActive()
                        val line = source.readUtf8Line() ?: break
                        val event = parser.parseLine(line)
                        if (event != null) {
                            onEvent(event)
                            terminalReceived = event is StreamDoneEvent || event is StreamErrorEvent
                        }
                    }

                    if (!terminalReceived) {
                        val event = parser.flush()
                        if (event != null) {
                            onEvent(event)
                            terminalReceived = event is StreamDoneEvent || event is StreamErrorEvent
                        }
                    }
                    if (!terminalReceived) {
                        error("SSE 连接中断，未收到 done/error 事件。")
                    }
                }
            } finally {
                cancellationHandle?.dispose()
            }
        }
    }

    private suspend inline fun <reified T> get(path: String): T = request(path, "GET")

    private suspend inline fun <reified T> delete(path: String): T = request(path, "DELETE")

    private suspend inline fun <reified T, reified B> post(path: String, body: B): T {
        return request(path, "POST", json.encodeToString(body).toRequestBody(contentType))
    }

    private suspend inline fun <reified T, reified B> patch(path: String, body: B): T {
        return request(path, "PATCH", json.encodeToString(body).toRequestBody(contentType))
    }

    private suspend inline fun <reified T> request(path: String, method: String, body: okhttp3.RequestBody? = null): T {
        return withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url("$baseUrl$path")
                .method(method, body)
                .header("content-type", "application/json")
                .build()
            client.newCall(request).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    error("HTTP ${response.code}: $responseText")
                }
                json.decodeFromString(responseText)
            }
        }
    }
}
