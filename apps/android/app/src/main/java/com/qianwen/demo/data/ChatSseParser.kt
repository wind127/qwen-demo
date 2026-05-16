package com.qianwen.demo.data

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class ChatSseParser(
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    private var eventName: String? = null
    private val dataLines = mutableListOf<String>()

    fun parseLine(line: String): ChatStreamEvent? {
        if (line.startsWith(":")) {
            return null
        }

        if (line.isBlank()) {
            return flush()
        }

        if (line.startsWith("event:")) {
            eventName = line.removePrefix("event:").trim()
            return null
        }

        if (line.startsWith("data:")) {
            var data = line.removePrefix("data:")
            if (data.startsWith(" ")) {
                data = data.drop(1)
            }
            dataLines += data
            return null
        }

        return null
    }

    fun flush(): ChatStreamEvent? {
        if (dataLines.isEmpty()) {
            eventName = null
            return null
        }

        val payload = dataLines.joinToString("\n")
        val type = runCatching {
            json.parseToJsonElement(payload).jsonObject["type"]?.jsonPrimitive?.contentOrNull
        }.getOrNull() ?: eventName

        eventName = null
        dataLines.clear()

        if (payload == "[DONE]") {
            return null
        }

        // SSE 帧可能来自弱网重试或服务端异常中断，这里将解析异常收敛成 error 事件，避免 UI 流程直接崩溃。
        return runCatching {
            when (type) {
                "conversation" -> json.decodeFromString<StreamConversationEvent>(payload)
                "message" -> json.decodeFromString<StreamMessageEvent>(payload)
                "delta" -> json.decodeFromString<StreamDeltaEvent>(payload)
                "done" -> json.decodeFromString<StreamDoneEvent>(payload)
                "error" -> json.decodeFromString<StreamErrorEvent>(payload)
                else -> null
            }
        }.getOrElse { error ->
            StreamErrorEvent(error = "SSE 解析失败：${error.message ?: "未知错误"}")
        }
    }
}
