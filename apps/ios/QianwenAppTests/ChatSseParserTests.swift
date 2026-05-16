import XCTest
@testable import QianwenApp

final class ChatSseParserTests: XCTestCase {
    func testParseDeltaEvent() throws {
        let parser = ChatSseParser()
        _ = try parser.parseLine("event: delta")
        _ = try parser.parseLine(#"data: {"type":"delta","messageId":"m-1","conversationId":"c-1","delta":"你好"}"#)

        let event = try parser.parseLine("")
        guard case .delta(let delta)? = event else {
            XCTFail("Expected delta event")
            return
        }

        XCTAssertEqual(delta.messageId, "m-1")
        XCTAssertEqual(delta.conversationId, "c-1")
        XCTAssertEqual(delta.delta, "你好")
    }

    func testParseMessageEventFromEventHeader() throws {
        let parser = ChatSseParser()
        _ = try parser.parseLine("event: message")
        _ = try parser.parseLine(#"data: {"message":{"id":"m-2","conversationId":"c-2","role":"assistant","content":"ok","status":"sent","createdAt":"2026-05-14T00:00:00.000Z","updatedAt":"2026-05-14T00:00:00.000Z"}}"#)

        let event = try parser.parseLine("")
        guard case .message(let messageEvent)? = event else {
            XCTFail("Expected message event")
            return
        }

        XCTAssertEqual(messageEvent.message.id, "m-2")
        XCTAssertEqual(messageEvent.message.content, "ok")
    }

    func testParseDoneEvent() throws {
        let parser = ChatSseParser()
        _ = try parser.parseLine("event: done")
        _ = try parser.parseLine(#"data: {"type":"done","message":{"id":"m-3","conversationId":"c-3","role":"assistant","content":"完成","status":"sent","createdAt":"2026-05-14T00:00:00.000Z","updatedAt":"2026-05-14T00:00:00.000Z"}}"#)

        let event = try parser.parseLine("")
        guard case .done(let doneEvent)? = event else {
            XCTFail("Expected done event")
            return
        }

        XCTAssertEqual(doneEvent.message.id, "m-3")
        XCTAssertEqual(doneEvent.message.content, "完成")
        XCTAssertEqual(doneEvent.message.status, "sent")
    }

    func testParseErrorEvent() throws {
        let parser = ChatSseParser()
        _ = try parser.parseLine("event: error")
        _ = try parser.parseLine(#"data: {"type":"error","messageId":"m-4","conversationId":"c-4","error":"模型失败"}"#)

        let event = try parser.parseLine("")
        guard case .error(let errorEvent)? = event else {
            XCTFail("Expected error event")
            return
        }

        XCTAssertEqual(errorEvent.messageId, "m-4")
        XCTAssertEqual(errorEvent.conversationId, "c-4")
        XCTAssertEqual(errorEvent.error, "模型失败")
    }

    func testParseMultilineDataFrame() throws {
        let parser = ChatSseParser()
        _ = try parser.parseLine("event: delta")
        _ = try parser.parseLine(#"data: {"type":"delta","#)
        _ = try parser.parseLine(#"data: "messageId":"m-5","conversationId":"c-5","delta":"多行"}"#)

        let event = try parser.parseLine("")
        guard case .delta(let delta)? = event else {
            XCTFail("Expected delta event")
            return
        }

        XCTAssertEqual(delta.messageId, "m-5")
        XCTAssertEqual(delta.conversationId, "c-5")
        XCTAssertEqual(delta.delta, "多行")
    }
}
