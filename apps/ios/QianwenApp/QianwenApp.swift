import SwiftUI

@main
struct QianwenApp: App {
    @StateObject private var store = QianwenStore()

    var body: some Scene {
        WindowGroup {
            ConversationListView()
                .environmentObject(store)
        }
    }
}

