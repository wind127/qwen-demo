package com.qianwen.demo.ui

import android.app.Application
import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudQueue
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.qianwen.demo.data.ChatMessage
import com.qianwen.demo.data.Conversation
import com.qianwen.demo.data.NativeScreen

private val PageBackground = Color.White
private val SidebarBackground = Color(0xFFF7F8FB)
private val TextPrimary = Color(0xFF171A1F)
private val TextSecondary = Color(0xFF7A828E)
private val LineColor = Color(0xFFE8EBF0)
private val UserBubble = Color(0xFFEDF6FF)
private val AssistantBubble = Color(0xFFF6F6F7)
private val InputBackground = Color(0xFFFFFFFF)
private val ChipBackground = Color(0xFFF7F8FB)
private val OnlineGreen = Color(0xFF1D7F45)

@Composable
private fun rememberQianwenViewModel(): QianwenViewModel {
    val application = LocalContext.current.applicationContext as Application
    return viewModel(factory = QianwenViewModel.factory(application))
}

@Composable
fun QianwenApp(viewModel: QianwenViewModel? = null) {
    val actualViewModel = viewModel ?: rememberQianwenViewModel()
    val state by actualViewModel.state.collectAsState()

    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Color(0xFF242832),
            surface = PageBackground,
            background = PageBackground
        )
    ) {
        Surface(color = PageBackground, modifier = Modifier.fillMaxSize()) {
            when (val screen = state.screen) {
                NativeScreen.Conversations -> ConversationListScreen(state, actualViewModel)
                is NativeScreen.Chat -> ChatScreen(screen.title, state, actualViewModel)
                NativeScreen.Status -> StatusScreen(state, actualViewModel)
                NativeScreen.Settings -> SettingsScreen(state, actualViewModel)
            }
        }
    }
}

@Composable
private fun ConversationListScreen(state: QianwenUiState, viewModel: QianwenViewModel) {
    var editingConversationId by remember { mutableStateOf<String?>(null) }
    var editingTitle by remember { mutableStateOf("") }
    val query = state.searchQuery.trim()
    val visibleConversations =
        if (query.isEmpty()) {
            state.conversations
        } else {
            state.conversations.filter { it.title.contains(query, ignoreCase = true) }
        }

    Column(
        Modifier
            .fillMaxSize()
            .background(SidebarBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text("千问", color = Color(0xFF11182B), fontSize = 30.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { viewModel.navigate(NativeScreen.Settings) }) {
                Icon(Icons.Filled.Settings, contentDescription = "设置", tint = TextPrimary)
            }
        }

        Button(
            onClick = { viewModel.createConversation() },
            enabled = state.listStatus != ConversationListStatus.LOADING,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = TextPrimary),
            shape = RoundedCornerShape(14.dp)
        ) {
            Icon(Icons.Filled.Add, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("新建对话", fontWeight = FontWeight.Bold)
        }

        SearchField(value = state.searchQuery, onValueChange = { viewModel.updateSearchQuery(it) })

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            HomeNavItem(
                Icons.Filled.FolderOpen,
                "我的空间",
                Modifier.weight(1f),
                onClick = { viewModel.showNotice("我的空间会展示当前本地缓存和最近会话。") }
            )
            HomeNavItem(
                Icons.Filled.AutoAwesome,
                "智能体",
                Modifier.weight(1f),
                onClick = { viewModel.showNotice("智能体入口已响应，可在聊天页使用任务模板。") }
            )
        }

        if (state.listStatus == ConversationListStatus.LOADING) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = TextPrimary)
        }
        CacheText(state)
        ErrorText(state.error)
        NoticeText(state.notice)

        Text("最近对话", color = Color(0xFFB1B7C1), fontSize = 13.sp)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) {
            if (state.conversations.isEmpty()) {
                item {
                    EmptyText(
                        if (state.listStatus == ConversationListStatus.OFFLINE) {
                            "服务端离线，当前没有可恢复的本地会话。"
                        } else {
                            "暂无会话，创建一个开始体验。"
                        }
                    )
                }
            } else if (visibleConversations.isEmpty()) {
                item { EmptyText("没有匹配的会话。") }
            }
            items(visibleConversations) { conversation ->
                ConversationRow(
                    conversation = conversation,
                    isEditing = editingConversationId == conversation.id,
                    editingTitle = editingTitle,
                    onEditingTitleChange = { editingTitle = it },
                    onStartRename = {
                        editingConversationId = conversation.id
                        editingTitle = conversation.title
                    },
                    onCancelRename = {
                        editingConversationId = null
                        editingTitle = ""
                    },
                    onSubmitRename = {
                        viewModel.renameConversation(conversation.id, editingTitle)
                        editingConversationId = null
                        editingTitle = ""
                    },
                    onTogglePinned = { viewModel.togglePinned(conversation) },
                    onDelete = { viewModel.deleteConversation(conversation.id) },
                    onClick = { viewModel.navigate(NativeScreen.Chat(conversation.id, conversation.title)) }
                )
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Filled.CloudQueue, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(18.dp))
            Text("服务端 ${state.health?.modelMode ?: serviceStatusText(state.serviceStatus)}", color = TextSecondary)
        }
    }
}

@Composable
private fun ChatScreen(title: String, state: QianwenUiState, viewModel: QianwenViewModel) {
    val conversationId = state.selectedConversationId
    val messages = conversationId?.let { state.messagesByConversation[it] }.orEmpty()

    Column(
        Modifier
            .fillMaxSize()
            .background(PageBackground)
            .statusBarsPadding()
    ) {
        ChatTopBar(
            title = "千问",
            subtitle = title,
            onBack = { viewModel.navigate(NativeScreen.Conversations) },
            onStatus = { viewModel.navigate(NativeScreen.Status) }
        )

        SendStateText(state)
        ErrorText(state.error)
        NoticeText(state.notice)

        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(start = 30.dp, end = 30.dp, top = 18.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            if (messages.isEmpty()) {
                item { MobileWelcome() }
            }
            items(messages) { message -> MobileMessageBubble(message, viewModel) }
        }

        MobileComposer(
            state = state,
            onDraftChange = { viewModel.updateDraft(it) },
            onSend = { viewModel.sendMessage() },
            onCancel = { viewModel.cancelSending() },
            onRetry = { viewModel.retryLastMessage() },
            onClear = { viewModel.clearMessages() },
            onStatus = { viewModel.navigate(NativeScreen.Status) },
            onTemplate = { viewModel.applyComposerTemplate(it) },
            canSend = state.draft.isNotBlank() && !conversationId.isNullOrBlank()
        )
    }
}

@Composable
private fun StatusScreen(state: QianwenUiState, viewModel: QianwenViewModel) {
    Column(
        Modifier
            .fillMaxSize()
            .background(PageBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        SimpleTopBar(title = "服务状态", onBack = { viewModel.navigate(NativeScreen.Conversations) })
        StatusStrip(state)
        ErrorText(state.error)
        NoticeText(state.notice)
        Surface(color = ChipBackground, shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                InfoLine("status", state.health?.status ?: "unknown")
                InfoLine("modelMode", state.health?.modelMode ?: "unknown")
                InfoLine("timestamp", state.health?.timestamp ?: "-")
                InfoLine("lastCheck", state.lastHealthCheckedAt ?: "-")
                InfoLine("cache", cacheStatusText(state.cacheStatus))
                InfoLine("cacheSavedAt", state.lastCacheSavedAt ?: "-")
                InfoLine("api", state.apiBaseUrl)
            }
        }
        Text(
            "Android Emulator 访问宿主机服务端使用 http://10.0.2.2:8787；真机需要改成电脑局域网 IP。",
            color = TextSecondary,
            lineHeight = 20.sp
        )
        Button(onClick = { viewModel.refreshHealth(showFeedback = true) }, shape = RoundedCornerShape(18.dp)) {
            Text("重新检查")
        }
    }
}

@Composable
private fun SettingsScreen(state: QianwenUiState, viewModel: QianwenViewModel) {
    Column(
        Modifier
            .fillMaxSize()
            .background(PageBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        SimpleTopBar(title = "调试设置", onBack = { viewModel.navigate(NativeScreen.Conversations) })
        NoticeText(state.notice)
        Surface(color = ChipBackground, shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                InfoLine("当前 API", state.apiBaseUrl)
                Text("模拟器：10.0.2.2 会映射到开发电脑的 localhost。", color = TextPrimary)
                Text("真机：将 BuildConfig 中的 QWEN_API_BASE_URL 改为电脑局域网 IP。", color = TextPrimary)
                Text("本地缓存：DataStore 保存最近会话、消息和选中会话。", color = TextPrimary)
            }
        }
    }
}

@Composable
private fun ChatTopBar(title: String, subtitle: String, onBack: () -> Unit, onStatus: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(72.dp)
            .padding(horizontal = 14.dp)
    ) {
        IconButton(onClick = onBack, modifier = Modifier.align(Alignment.CenterStart)) {
            Icon(Icons.Filled.Menu, contentDescription = "返回会话列表", tint = TextPrimary, modifier = Modifier.size(30.dp))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.align(Alignment.Center)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, fontSize = 28.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, tint = TextSecondary)
            }
            Text(subtitle, maxLines = 1, overflow = TextOverflow.Ellipsis, color = TextSecondary, fontSize = 12.sp)
        }
        IconButton(onClick = onStatus, modifier = Modifier.align(Alignment.CenterEnd)) {
            Icon(Icons.Filled.VolumeOff, contentDescription = "服务状态", tint = TextPrimary, modifier = Modifier.size(30.dp))
        }
    }
}

@Composable
private fun SimpleTopBar(title: String, onBack: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        IconButton(onClick = onBack) {
            Icon(Icons.Filled.ArrowBack, contentDescription = "返回")
        }
        Text(title, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
    }
}

@Composable
private fun SearchField(value: String, onValueChange: (String) -> Unit) {
    Surface(color = Color.White, shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, LineColor)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().height(50.dp).padding(horizontal = 14.dp)
        ) {
            Icon(Icons.Filled.Search, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = TextStyle(color = TextPrimary, fontSize = 16.sp),
                modifier = Modifier.weight(1f),
                decorationBox = { inner ->
                    if (value.isBlank()) {
                        Text("搜索会话", color = Color(0xFFA0A7B2), fontSize = 16.sp)
                    }
                    inner()
                }
            )
        }
    }
}

@Composable
private fun HomeNavItem(icon: ImageVector, text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        color = Color(0xFFF0F1F3),
        shape = RoundedCornerShape(14.dp),
        modifier = modifier.height(52.dp).clickable(onClick = onClick)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 14.dp)) {
            Icon(icon, contentDescription = null, tint = TextPrimary)
            Spacer(Modifier.width(8.dp))
            Text(text, color = TextPrimary, fontSize = 16.sp)
        }
    }
}

@Composable
private fun StatusStrip(state: QianwenUiState) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        StatusPill("服务", serviceStatusText(state.serviceStatus), serviceStatusColor(state.serviceStatus), Modifier.weight(1f))
        StatusPill("列表", listStatusText(state.listStatus), Color(0xFF51637C), Modifier.weight(1f))
    }
}

@Composable
private fun StatusPill(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Surface(color = ChipBackground, shape = RoundedCornerShape(16.dp), modifier = modifier) {
        Column(Modifier.padding(14.dp)) {
            Text(label, color = TextSecondary, fontSize = 12.sp)
            Text(value, color = color, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ConversationRow(
    conversation: Conversation,
    isEditing: Boolean,
    editingTitle: String,
    onEditingTitleChange: (String) -> Unit,
    onStartRename: () -> Unit,
    onCancelRename: () -> Unit,
    onSubmitRename: () -> Unit,
    onTogglePinned: () -> Unit,
    onDelete: () -> Unit,
    onClick: () -> Unit
) {
    Surface(color = if (isEditing) Color.White else Color.Transparent, shape = RoundedCornerShape(14.dp)) {
        Column(
            Modifier
                .fillMaxWidth()
                .clickable(enabled = !isEditing, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (isEditing) {
                OutlinedTextField(
                    value = editingTitle,
                    onValueChange = onEditingTitleChange,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(onClick = onSubmitRename, enabled = editingTitle.isNotBlank()) {
                        Icon(Icons.Filled.Check, contentDescription = "保存")
                    }
                    IconButton(onClick = onCancelRename) {
                        Icon(Icons.Filled.Close, contentDescription = "取消")
                    }
                }
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (conversation.pinned) {
                        Icon(Icons.Filled.PushPin, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                    }
                    Text(
                        conversation.title,
                        color = TextPrimary,
                        fontSize = 16.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = onTogglePinned, modifier = Modifier.size(34.dp)) {
                        Icon(Icons.Filled.PushPin, contentDescription = "置顶", tint = TextSecondary, modifier = Modifier.size(18.dp))
                    }
                    IconButton(onClick = onStartRename, modifier = Modifier.size(34.dp)) {
                        Icon(Icons.Filled.Edit, contentDescription = "重命名", tint = TextSecondary, modifier = Modifier.size(18.dp))
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(34.dp)) {
                        Icon(Icons.Filled.Delete, contentDescription = "删除", tint = TextSecondary, modifier = Modifier.size(18.dp))
                    }
                }
                Text(conversation.updatedAt, color = Color(0xFFA0A7B2), fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun MobileMessageBubble(message: ChatMessage, viewModel: QianwenViewModel) {
    val isUser = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Column(
            horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
            modifier = Modifier.widthIn(max = if (isUser) 260.dp else 330.dp)
        ) {
            Surface(
                color = if (isUser) UserBubble else AssistantBubble,
                shape = RoundedCornerShape(
                    topStart = 24.dp,
                    topEnd = 24.dp,
                    bottomStart = if (isUser) 24.dp else 8.dp,
                    bottomEnd = if (isUser) 8.dp else 24.dp
                )
            ) {
                Text(
                    message.content.ifBlank { "正在生成..." },
                    color = TextPrimary,
                    fontSize = 18.sp,
                    lineHeight = 30.sp,
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp)
                )
            }
            if (!isUser) {
                AssistantActionRow(message, viewModel)
            }
            if (message.status == "streaming" || message.status == "error" || message.error != null) {
                Text(
                    "状态：${message.status}${message.error?.let { " · $it" } ?: ""}",
                    color = if (message.status == "error") Color(0xFFA3341D) else TextSecondary,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

@Composable
private fun AssistantActionRow(message: ChatMessage, viewModel: QianwenViewModel) {
    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.padding(top = 12.dp, start = 4.dp).horizontalScroll(rememberScrollState())
    ) {
        SmallActionIcon(Icons.Filled.VolumeUp, "朗读") { viewModel.showNotice("朗读入口已响应。") }
        SmallActionIcon(Icons.Filled.Share, "分享") {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, message.content)
            }
            context.startActivity(Intent.createChooser(shareIntent, "分享回复"))
            viewModel.showNotice("已打开系统分享。")
        }
        SmallActionIcon(Icons.Filled.ContentCopy, "复制") {
            clipboardManager.setText(AnnotatedString(message.content))
            viewModel.showNotice("回复已复制。")
        }
        SmallActionIcon(Icons.Filled.Edit, "编辑") { viewModel.useMessageAsDraft(message.content) }
        SmallActionIcon(Icons.Filled.Refresh, "重新生成") { viewModel.regenerateFromMessage(message) }
        SmallActionIcon(Icons.Filled.ThumbUp, "赞同") { viewModel.showNotice("已记录赞同反馈。") }
        SmallActionIcon(Icons.Filled.ThumbDown, "反对") { viewModel.showNotice("已记录反对反馈。") }
    }
}

@Composable
private fun SmallActionIcon(icon: ImageVector, description: String, onClick: () -> Unit) {
    IconButton(onClick = onClick, modifier = Modifier.size(32.dp)) {
        Icon(icon, contentDescription = description, tint = TextSecondary, modifier = Modifier.size(21.dp))
    }
}

@Composable
private fun MobileWelcome() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth().padding(top = 90.dp)
    ) {
        Text("嗨，你好呀！", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Text("今天想聊点什么，或者需要我帮忙吗？", color = TextSecondary, textAlign = TextAlign.Center, lineHeight = 22.sp)
    }
}

@Composable
private fun MobileComposer(
    state: QianwenUiState,
    onDraftChange: (String) -> Unit,
    onSend: () -> Unit,
    onCancel: () -> Unit,
    onRetry: () -> Unit,
    onClear: () -> Unit,
    onStatus: () -> Unit,
    onTemplate: (String) -> Unit,
    canSend: Boolean
) {
    Column(
        Modifier
            .fillMaxWidth()
            .imePadding()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.horizontalScroll(rememberScrollState())
        ) {
            ToolChip(Icons.Filled.AutoAwesome, "思考", onClick = { onTemplate("请一步一步思考：") })
            ToolChip(Icons.Filled.Work, "办事", onClick = { onTemplate("请给出可执行办事方案：") })
            ToolChip(Icons.Filled.Image, "AI生图", onClick = { onTemplate("请帮我写一段 AI 生图提示词：") })
            ToolChip(Icons.Filled.CameraAlt, "拍题答疑", onClick = { onTemplate("请根据这道题逐步讲解：") })
            ToolChip(Icons.Filled.CloudQueue, "服务状态", onClick = onStatus)
            ToolChip(Icons.Filled.Delete, "清空", onClick = onClear)
            if (state.isStreaming) {
                ToolChip(Icons.Filled.Close, "取消生成", onClick = onCancel)
            }
            if (state.retryDraft != null && !state.isStreaming) {
                ToolChip(Icons.Filled.Refresh, "重试", onClick = onRetry)
            }
        }
        Surface(
            color = InputBackground,
            shape = RoundedCornerShape(30.dp),
            border = BorderStroke(1.dp, LineColor),
            shadowElevation = 8.dp
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp)
            ) {
                Surface(color = Color.White, shape = CircleShape, border = BorderStroke(1.dp, LineColor)) {
                    Icon(Icons.Filled.GraphicEq, contentDescription = null, tint = TextPrimary, modifier = Modifier.padding(8.dp).size(22.dp))
                }
                Spacer(Modifier.width(10.dp))
                BasicTextField(
                    value = state.draft,
                    onValueChange = onDraftChange,
                    enabled = !state.isStreaming,
                    minLines = 1,
                    maxLines = 4,
                    textStyle = TextStyle(color = TextPrimary, fontSize = 18.sp),
                    modifier = Modifier.weight(1f),
                    decorationBox = { inner ->
                        if (state.draft.isBlank()) {
                            Text("发消息或按住说话...", color = Color(0xFFA0A7B2), fontSize = 18.sp)
                        }
                        inner()
                    }
                )
                IconButton(onClick = { onTemplate("请根据这张图片或题目逐步讲解：") }, enabled = !state.isStreaming) {
                    Icon(Icons.Filled.CameraAlt, contentDescription = "拍照", tint = TextPrimary)
                }
                IconButton(onClick = onSend, enabled = canSend && !state.isStreaming) {
                    Icon(
                        if (canSend) Icons.Filled.ArrowUpward else Icons.Filled.Add,
                        contentDescription = "发送",
                        tint = if (canSend) TextPrimary else TextSecondary
                    )
                }
            }
        }
        Text("内容由 AI 生成", color = Color(0xFFC1C5CC), fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun ToolChip(icon: ImageVector, text: String, onClick: () -> Unit) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, LineColor),
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 13.dp, vertical = 9.dp)) {
            Icon(icon, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(6.dp))
            Text(text, color = TextPrimary, fontSize = 15.sp, maxLines = 1)
        }
    }
}

@Composable
private fun CacheText(state: QianwenUiState) {
    val savedAt = state.lastCacheSavedAt ?: return
    Text("本地缓存：${cacheStatusText(state.cacheStatus)} · $savedAt", color = TextSecondary, fontSize = 12.sp)
}

@Composable
private fun SendStateText(state: QianwenUiState) {
    val text = when (state.sendStatus) {
        SendStatus.IDLE -> null
        SendStatus.STREAMING -> "正在接收 SSE 增量回复，可取消本次生成。"
        SendStatus.FAILED -> "发送失败，输入已保留，可点击重试。"
        SendStatus.CANCELED -> "已取消生成，输入仍保留。"
    }
    if (text != null) {
        Text(
            text,
            color = TextSecondary,
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFF6F6F7))
                .padding(horizontal = 20.dp, vertical = 10.dp)
        )
    }
}

@Composable
private fun EmptyText(text: String) {
    Text(text, color = TextSecondary)
}

@Composable
private fun ErrorText(error: String?) {
    if (!error.isNullOrBlank()) {
        Text(
            error,
            color = Color(0xFF8F2C18),
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFFFF3F0), RoundedCornerShape(14.dp))
                .padding(12.dp)
        )
    }
}

@Composable
private fun NoticeText(notice: String?) {
    if (!notice.isNullOrBlank()) {
        Text(
            notice,
            color = Color(0xFF25527F),
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFF2F8FF), RoundedCornerShape(14.dp))
                .padding(12.dp)
        )
    }
}

@Composable
private fun InfoLine(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, color = TextSecondary, fontSize = 12.sp)
        Text(value, color = TextPrimary, fontSize = 15.sp)
    }
}

private fun serviceStatusText(status: ServiceStatus): String {
    return when (status) {
        ServiceStatus.CHECKING -> "检查中"
        ServiceStatus.ONLINE -> "在线"
        ServiceStatus.OFFLINE -> "离线"
    }
}

private fun serviceStatusColor(status: ServiceStatus): Color {
    return when (status) {
        ServiceStatus.CHECKING -> Color(0xFF8A6D1D)
        ServiceStatus.ONLINE -> OnlineGreen
        ServiceStatus.OFFLINE -> Color(0xFF8F2C18)
    }
}

private fun listStatusText(status: ConversationListStatus): String {
    return when (status) {
        ConversationListStatus.LOADING -> "加载中"
        ConversationListStatus.READY -> "已就绪"
        ConversationListStatus.EMPTY -> "空列表"
        ConversationListStatus.OFFLINE -> "离线缓存"
    }
}

private fun cacheStatusText(status: CacheStatus): String {
    return when (status) {
        CacheStatus.EMPTY -> "无缓存"
        CacheStatus.RESTORED -> "已恢复"
        CacheStatus.SAVED -> "已保存"
        CacheStatus.CORRUPTED -> "缓存异常"
    }
}
