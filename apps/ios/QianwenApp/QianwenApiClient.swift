import Foundation

enum QianwenApiError: Error, LocalizedError {
    case invalidResponse
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "服务端响应无效。"
        case .httpStatus(let status):
            return "HTTP \(status)"
        }
    }
}

final class QianwenApiClient {
    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(baseURL: URL = URL(string: "http://localhost:8787")!, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func health() async throws -> HealthResponse {
        try await request(path: "/health", method: "GET")
    }

    func listConversations() async throws -> ConversationsResponse {
        try await request(path: "/conversations", method: "GET")
    }

    func createConversation(title: String) async throws -> CreateConversationResponse {
        try await request(path: "/conversations", method: "POST", body: CreateConversationRequest(title: title))
    }

    func updateConversation(conversationId: String, title: String? = nil, pinned: Bool? = nil) async throws -> CreateConversationResponse {
        try await request(
            path: "/conversations/\(conversationId)",
            method: "PATCH",
            body: UpdateConversationRequest(title: title, pinned: pinned)
        )
    }

    func deleteConversation(conversationId: String) async throws -> ConversationsResponse {
        try await request(path: "/conversations/\(conversationId)", method: "DELETE")
    }

    func getMessages(conversationId: String) async throws -> MessagesResponse {
        try await request(path: "/conversations/\(conversationId)/messages", method: "GET")
    }

    func clearMessages(conversationId: String) async throws -> MessagesResponse {
        try await request(path: "/conversations/\(conversationId)/messages", method: "DELETE")
    }

    func chat(conversationId: String, message: String) async throws -> ChatResponse {
        try await request(path: "/chat", method: "POST", body: ChatRequest(conversationId: conversationId, message: message))
    }

    func streamChat(
        conversationId: String,
        message: String,
        onEvent: @escaping @Sendable (ChatStreamEvent) async -> Void
    ) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("chat/stream"))
        request.httpMethod = "POST"
        request.setValue("text/event-stream", forHTTPHeaderField: "accept")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(ChatRequest(conversationId: conversationId, message: message))
        let (bytes, response) = try await session.bytes(for: request)
        try validate(response)

        let parser = ChatSseParser(decoder: decoder)

        for try await line in bytes.lines {
            if let event = try parser.parseLine(line) {
                await onEvent(event)
            }
        }
        if let event = try parser.flush() {
            await onEvent(event)
        }
    }

    private func request<T: Decodable>(path: String, method: String) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(String(path.dropFirst())))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    private func request<T: Decodable, B: Encodable>(path: String, method: String, body: B) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(String(path.dropFirst())))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(body)
        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else {
            throw QianwenApiError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw QianwenApiError.httpStatus(http.statusCode)
        }
    }

}

final class ChatSseParser {
    private var eventName: String?
    private var dataLines: [String] = []
    private let decoder: JSONDecoder

    init(decoder: JSONDecoder = JSONDecoder()) {
        self.decoder = decoder
    }

    func parseLine(_ line: String) throws -> ChatStreamEvent? {
        if line.isEmpty {
            return try flush()
        }

        if line.hasPrefix("event:") {
            eventName = String(line.dropFirst("event:".count)).trimmingCharacters(in: .whitespaces)
            return nil
        }

        if line.hasPrefix("data:") {
            var data = String(line.dropFirst("data:".count))
            if data.hasPrefix(" ") {
                data.removeFirst()
            }
            dataLines.append(data)
            return nil
        }

        return nil
    }

    func flush() throws -> ChatStreamEvent? {
        guard !dataLines.isEmpty else {
            eventName = nil
            return nil
        }

        let payload = dataLines.joined(separator: "\n")
        let data = Data(payload.utf8)
        let eventType = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["type"] as? String
        let type = eventType ?? eventName

        eventName = nil
        dataLines.removeAll(keepingCapacity: true)

        switch type {
        case "conversation":
            return .conversation(try decoder.decode(StreamConversationEvent.self, from: data))
        case "message":
            return .message(try decoder.decode(StreamMessageEvent.self, from: data))
        case "delta":
            return .delta(try decoder.decode(StreamDeltaEvent.self, from: data))
        case "done":
            return .done(try decoder.decode(StreamDoneEvent.self, from: data))
        case "error":
            return .error(try decoder.decode(StreamErrorEvent.self, from: data))
        default:
            return nil
        }
    }
}
