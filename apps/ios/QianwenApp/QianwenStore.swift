import Foundation

@MainActor
final class QianwenStore: ObservableObject {
    @Published var conversations: [Conversation] = []
    @Published var messagesByConversation: [String: [ChatMessage]] = [:]
    @Published var selectedConversationId: String?
    @Published var health: HealthResponse?
    @Published var loading = false
    @Published var sending = false
    @Published var error: String?
    @Published var searchQuery = ""

    let apiBaseURL = "http://localhost:8787"
    private let client = QianwenApiClient()
    private let snapshotKey = "qianwen-ios-snapshot"

    init() {
        restore()
        Task {
            await refreshHealth()
            await refreshConversations()
        }
    }

    func refreshHealth() async {
        do {
            health = try await client.health()
            error = nil
        } catch {
            self.error = "服务端健康检查失败。"
        }
    }

    func refreshConversations() async {
        loading = true
        defer { loading = false }
        do {
            conversations = try await client.listConversations().conversations.sortedForDisplay()
            persist()
            error = nil
        } catch {
            self.error = "无法连接服务端，已保留本地历史。"
        }
    }

    func createConversation() async {
        loading = true
        defer { loading = false }
        do {
            let conversation = try await client.createConversation(title: "iOS 会话").conversation
            conversations = ([conversation] + conversations.filter { $0.id != conversation.id }).sortedForDisplay()
            selectedConversationId = conversation.id
            messagesByConversation[conversation.id] = messagesByConversation[conversation.id] ?? []
            persist()
            error = nil
        } catch {
            self.error = "新建会话失败。"
        }
    }

    func renameConversation(_ conversation: Conversation, title: String) async {
        let nextTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !nextTitle.isEmpty else {
            return
        }

        do {
            let updated = try await client.updateConversation(
                conversationId: conversation.id,
                title: nextTitle
            ).conversation
            conversations = conversations.upserting(updated).sortedForDisplay()
            persist()
            error = nil
        } catch {
            self.error = "重命名失败，请稍后重试。"
        }
    }

    func togglePinned(_ conversation: Conversation) async {
        do {
            let updated = try await client.updateConversation(
                conversationId: conversation.id,
                pinned: !conversation.pinned
            ).conversation
            conversations = conversations.upserting(updated).sortedForDisplay()
            persist()
            error = nil
        } catch {
            self.error = "置顶状态同步失败。"
        }
    }

    func deleteConversation(_ conversation: Conversation) async {
        do {
            let response = try await client.deleteConversation(conversationId: conversation.id)
            conversations = response.conversations.sortedForDisplay()
            messagesByConversation.removeValue(forKey: conversation.id)
            if selectedConversationId == conversation.id {
                selectedConversationId = conversations.first?.id
            }
            persist()
            error = nil
        } catch {
            self.error = "删除会话失败，请稍后重试。"
        }
    }

    func selectConversation(_ conversation: Conversation) async {
        selectedConversationId = conversation.id
        do {
            messagesByConversation[conversation.id] = try await client.getMessages(conversationId: conversation.id).messages
            persist()
            error = nil
        } catch {
            self.error = "消息加载失败，已展示本地缓存。"
        }
    }

    func sendMessage(_ text: String) async {
        let prompt = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let conversationId = selectedConversationId, !prompt.isEmpty, !sending else {
            return
        }

        sending = true
        defer { sending = false }
        do {
            try await client.streamChat(conversationId: conversationId, message: prompt) { [weak self] event in
                guard let self else { return }
                await MainActor.run {
                    self.applyStreamEvent(event, requestedConversationId: conversationId)
                }
            }
            persist()
            error = nil
        } catch {
            self.error = "发送失败，请确认服务端已启动。"
        }
    }

    func clearMessages() async {
        guard let conversationId = selectedConversationId else {
            return
        }
        do {
            messagesByConversation[conversationId] = try await client.clearMessages(conversationId: conversationId).messages
            persist()
            error = nil
        } catch {
            self.error = "清空失败。"
        }
    }

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: snapshotKey),
              let snapshot = try? JSONDecoder().decode(LocalSnapshot.self, from: data) else {
            return
        }
        conversations = snapshot.conversations.sortedForDisplay()
        messagesByConversation = snapshot.messagesByConversation
        selectedConversationId = snapshot.selectedConversationId
    }

    private func persist() {
        let snapshot = LocalSnapshot(
            conversations: conversations,
            messagesByConversation: messagesByConversation,
            selectedConversationId: selectedConversationId
        )
        if let data = try? JSONEncoder().encode(snapshot) {
            UserDefaults.standard.set(data, forKey: snapshotKey)
        }
    }

    private func applyStreamEvent(_ event: ChatStreamEvent, requestedConversationId: String) {
        switch event {
        case .conversation(let streamEvent):
            conversations = conversations.upserting(streamEvent.conversation).sortedForDisplay()
            selectedConversationId = streamEvent.conversation.id

        case .message(let streamEvent):
            let conversationId = streamEvent.message.conversationId
            var messages = messagesByConversation[conversationId] ?? []
            messages.upsert(streamEvent.message)
            messagesByConversation[conversationId] = messages

        case .delta(let streamEvent):
            let conversationId = streamEvent.conversationId
            var messages = messagesByConversation[conversationId] ?? []
            if let index = messages.firstIndex(where: { $0.id == streamEvent.messageId }) {
                messages[index].content += streamEvent.delta
                messages[index].status = "streaming"
            }
            messagesByConversation[conversationId] = messages

        case .done(let streamEvent):
            let conversationId = streamEvent.message.conversationId
            var messages = messagesByConversation[conversationId] ?? []
            messages.upsert(streamEvent.message)
            messagesByConversation[conversationId] = messages

        case .error(let streamEvent):
            let conversationId = streamEvent.conversationId ?? requestedConversationId
            var messages = messagesByConversation[conversationId] ?? []
            if let messageId = streamEvent.messageId, let index = messages.firstIndex(where: { $0.id == messageId }) {
                messages[index].status = "error"
                messages[index].error = streamEvent.error
            }
            messagesByConversation[conversationId] = messages
            error = streamEvent.error
        }
    }
}

private extension Array where Element == Conversation {
    func sortedForDisplay() -> [Conversation] {
        sorted {
            if $0.pinned != $1.pinned {
                return $0.pinned && !$1.pinned
            }
            return $0.updatedAt > $1.updatedAt
        }
    }

    func upserting(_ conversation: Conversation) -> [Conversation] {
        [conversation] + filter { $0.id != conversation.id }
    }
}

private extension Array where Element == ChatMessage {
    mutating func upsert(_ message: ChatMessage) {
        if let index = firstIndex(where: { $0.id == message.id }) {
            self[index] = message
            return
        }
        append(message)
    }
}
