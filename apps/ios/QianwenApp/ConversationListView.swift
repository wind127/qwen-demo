import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject private var store: QianwenStore
    @State private var showStatus = false
    @State private var editingConversationId: String?
    @State private var editingTitle = ""

    private var visibleConversations: [Conversation] {
        let query = store.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return store.conversations
        }

        return store.conversations.filter { conversation in
            conversation.title.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                header
                if let error = store.error {
                    errorBanner(error)
                }
                TextField("搜索会话", text: $store.searchQuery)
                    .textFieldStyle(.roundedBorder)
                List {
                    if store.conversations.isEmpty {
                        Text("暂无会话，创建一个开始体验。")
                            .foregroundStyle(.secondary)
                    } else if visibleConversations.isEmpty {
                        Text("没有匹配的会话。")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(visibleConversations) { conversation in
                        VStack(alignment: .leading, spacing: 8) {
                            if editingConversationId == conversation.id {
                                TextField("会话名称", text: $editingTitle)
                                    .textFieldStyle(.roundedBorder)
                                HStack {
                                    Button("保存") {
                                        Task {
                                            await store.renameConversation(conversation, title: editingTitle)
                                            editingConversationId = nil
                                            editingTitle = ""
                                        }
                                    }
                                    .disabled(editingTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                                    Button("取消") {
                                        editingConversationId = nil
                                        editingTitle = ""
                                    }
                                }
                                .buttonStyle(.borderless)
                            } else {
                                NavigationLink {
                                    ChatView(conversation: conversation)
                                        .environmentObject(store)
                                } label: {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(conversation.pinned ? "置顶 · \(conversation.title)" : conversation.title)
                                            .font(.headline)
                                        Text(conversation.updatedAt)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                HStack {
                                    Button(conversation.pinned ? "取消置顶" : "置顶") {
                                        Task { await store.togglePinned(conversation) }
                                    }
                                    Button("重命名") {
                                        editingConversationId = conversation.id
                                        editingTitle = conversation.title
                                    }
                                    Button("删除", role: .destructive) {
                                        Task { await store.deleteConversation(conversation) }
                                    }
                                }
                                .font(.caption)
                                .buttonStyle(.borderless)
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
            .padding()
            .navigationTitle("千问")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("状态") { showStatus = true }
                    Button("新建") {
                        Task { await store.createConversation() }
                    }
                }
            }
            .navigationDestination(isPresented: $showStatus) {
                StatusView().environmentObject(store)
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("千问")
                    .font(.largeTitle.bold())
                Text("iOS 原生 SwiftUI")
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

func errorBanner(_ text: String) -> some View {
    Text(text)
        .foregroundStyle(Color(red: 0.56, green: 0.17, blue: 0.09))
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(red: 1.0, green: 0.95, blue: 0.94))
        .clipShape(RoundedRectangle(cornerRadius: 8))
}
