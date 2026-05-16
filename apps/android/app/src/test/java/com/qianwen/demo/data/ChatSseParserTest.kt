package com.qianwen.demo.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatSseParserTest {
    @Test
    fun parsesDeltaEventFromSseLines() {
        val parser = ChatSseParser()
        parser.parseLine("event: delta")
        parser.parseLine("""data: {"type":"delta","messageId":"m-1","conversationId":"c-1","delta":"你好"}""")

        val event = parser.parseLine("")
        assertTrue(event is StreamDeltaEvent)
        val delta = event as StreamDeltaEvent
        assertEquals("m-1", delta.messageId)
        assertEquals("c-1", delta.conversationId)
        assertEquals("你好", delta.delta)
    }

    @Test
    fun parsesMessageEventWhenTypeComesFromEventHeader() {
        val parser = ChatSseParser()
        parser.parseLine("event: message")
        parser.parseLine(
            """data: {"message":{"id":"m-2","conversationId":"c-2","role":"assistant","content":"ok","status":"sent","createdAt":"2026-05-14T00:00:00.000Z","updatedAt":"2026-05-14T00:00:00.000Z"}}"""
        )

        val event = parser.parseLine("")
        assertTrue(event is StreamMessageEvent)
        val message = (event as StreamMessageEvent).message
        assertEquals("m-2", message.id)
        assertEquals("assistant", message.role)
        assertEquals("ok", message.content)
    }

    @Test
    fun flushReturnsNullWhenNoPendingFrame() {
        val parser = ChatSseParser()
        assertEquals(null, parser.flush())
    }

    @Test
    fun parsesDoneEvent() {
        val parser = ChatSseParser()
        parser.parseLine("event: done")
        parser.parseLine(
            """data: {"type":"done","message":{"id":"m-3","conversationId":"c-3","role":"assistant","content":"完成","status":"sent","createdAt":"2026-05-14T00:00:00.000Z","updatedAt":"2026-05-14T00:00:00.000Z"}}"""
        )

        val event = parser.parseLine("")
        assertTrue(event is StreamDoneEvent)
        val message = (event as StreamDoneEvent).message
        assertEquals("m-3", message.id)
        assertEquals("完成", message.content)
        assertEquals("sent", message.status)
    }

    @Test
    fun parsesErrorEvent() {
        val parser = ChatSseParser()
        parser.parseLine("event: error")
        parser.parseLine("""data: {"type":"error","messageId":"m-4","conversationId":"c-4","error":"模型失败"}""")

        val event = parser.parseLine("")
        assertTrue(event is StreamErrorEvent)
        val error = event as StreamErrorEvent
        assertEquals("m-4", error.messageId)
        assertEquals("c-4", error.conversationId)
        assertEquals("模型失败", error.error)
    }

    @Test
    fun parsesMultilineDataFrame() {
        val parser = ChatSseParser()
        parser.parseLine("event: delta")
        parser.parseLine("""data: {"type":"delta",""")
        parser.parseLine("""data: "messageId":"m-5","conversationId":"c-5","delta":"多行"}""")

        val event = parser.parseLine("")
        assertTrue(event is StreamDeltaEvent)
        val delta = event as StreamDeltaEvent
        assertEquals("m-5", delta.messageId)
        assertEquals("c-5", delta.conversationId)
        assertEquals("多行", delta.delta)
    }

    @Test
    fun malformedFrameReturnsErrorEventInsteadOfThrowing() {
        val parser = ChatSseParser()
        parser.parseLine("event: delta")
        parser.parseLine("""data: {"type":"delta"""")

        val event = parser.parseLine("")
        assertTrue(event is StreamErrorEvent)
        assertTrue((event as StreamErrorEvent).error.contains("SSE 解析失败"))
    }

    @Test
    fun ignoresSseCommentLines() {
        val parser = ChatSseParser()
        parser.parseLine(": keep-alive")
        parser.parseLine("event: error")
        parser.parseLine("""data: {"type":"error","error":"连接中断"}""")

        val event = parser.parseLine("")
        assertTrue(event is StreamErrorEvent)
        assertEquals("连接中断", (event as StreamErrorEvent).error)
    }
}
