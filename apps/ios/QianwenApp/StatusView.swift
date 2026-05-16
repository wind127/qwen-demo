import SwiftUI

struct StatusView: View {
    @EnvironmentObject private var store: QianwenStore

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("API 地址")
                .font(.headline)
            Text(store.apiBaseURL)
                .foregroundStyle(.secondary)
            if let error = store.error {
                errorBanner(error)
            }
            GroupBox("服务端") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("status: \(store.health?.status ?? "unknown")")
                    Text("modelMode: \(store.health?.modelMode ?? "unknown")")
                    Text("timestamp: \(store.health?.timestamp ?? "-")")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button("重新检查") {
                Task { await store.refreshHealth() }
            }
            .buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding()
        .navigationTitle("服务状态")
    }
}

