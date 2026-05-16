import SwiftUI

struct ChatView: View {
    let conversation: Conversation
    @EnvironmentObject private var store: QianwenStore
    @State private var draft = ""

    private var messages: [ChatMessage] {
        store.messagesByConversation[conversation.id] ?? []
    }

    var body: some View {
        VStack(spacing: 12) {
            if let error = store.error {
                errorBanner(error)
            }
            ScrollView {
                LazyVStack(spacing: 10) {
                    if messages.isEmpty {
                        Text("向千问发送第一条消息。")
                            .foregroundStyle(.secondary)
                            .padding(.top, 40)
                    }
                    ForEach(messages) { message in
                        messageBubble(message)
                    }
                }
            }
            HStack {
                Button("清空") {
                    Task { await store.clearMessages() }
                }
                Spacer()
            }
            TextEditor(text: $draft)
                .frame(minHeight: 72, maxHeight: 120)
                .overlay {
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.gray.opacity(0.25))
                }
            Button(store.sending ? "发送中" : "发送") {
                let text = draft
                draft = ""
                Task { await store.sendMessage(text) }
            }
            .buttonStyle(.borderedProminent)
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.sending)
        }
        .padding()
        .navigationTitle(conversation.title)
        .task {
            await store.selectConversation(conversation)
        }
    }

    private func messageBubble(_ message: ChatMessage) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(message.role == "user" ? "你" : "千问")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            Text(message.content.isEmpty ? "正在生成..." : message.content)
            Text(message.status)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(message.role == "user" ? Color.green.opacity(0.12) : Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .shadow(color: Color.black.opacity(0.04), radius: 2, y: 1)
    }
}

