let currentConversationId = null;
let isStreaming = false;

const messagesList = document.getElementById("messages");
const inputEl = document.getElementById("input");
const form = document.getElementById("input-form");
const btnSend = document.getElementById("btn-send");
const btnNew = document.getElementById("btn-new");
const convList = document.getElementById("conversation-list");

async function loadConversations() {
  const res = await fetch("/api/conversations");
  const data = await res.json();
  renderSidebar(data);
}

function renderSidebar(conversations) {
  convList.innerHTML = "";
  for (const conv of conversations) {
    const li = document.createElement("li");
    li.className = "conv-item" + (conv.id === currentConversationId ? " active" : "");
    li.dataset.id = conv.id;
    li.innerHTML = `
      <div class="conv-info">
        <div class="conv-preview">${escapeHtml(conv.preview || "Leeres Gespräch")}</div>
        <div class="conv-date">${conv.updated_at}</div>
      </div>
      <button class="conv-delete" title="Löschen" data-id="${conv.id}">✕</button>
    `;
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("conv-delete")) return;
      openConversation(conv.id);
    });
    li.querySelector(".conv-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });
    convList.appendChild(li);
  }
}

async function openConversation(id) {
  currentConversationId = id;
  const res = await fetch(`/api/conversations/${id}`);
  if (!res.ok) return;
  const data = await res.json();
  messagesList.innerHTML = "";
  for (const msg of data.messages) {
    appendMessage(msg.role, msg.content);
  }
  scrollToBottom();
  loadConversations();
}

async function deleteConversation(id) {
  await fetch(`/api/conversations/${id}`, { method: "DELETE" });
  if (currentConversationId === id) {
    currentConversationId = null;
    messagesList.innerHTML = "";
  }
  loadConversations();
}

function appendMessage(role, content) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.textContent = content;
  }
  div.appendChild(bubble);
  messagesList.appendChild(div);
  return bubble;
}

async function sendMessage(text) {
  if (!text.trim() || isStreaming) return;
  isStreaming = true;
  btnSend.disabled = true;

  appendMessage("user", text);
  scrollToBottom();

  const assistantBubble = appendMessage("assistant", "");
  scrollToBottom();

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: currentConversationId, message: text }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.done) {
        currentConversationId = payload.conversation_id;
        loadConversations();
      } else if (payload.text) {
        fullText += payload.text;
        assistantBubble.innerHTML = renderMarkdown(fullText);
        scrollToBottom();
      }
    }
  }

  isStreaming = false;
  btnSend.disabled = false;
  inputEl.focus();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = inputEl.value;
  inputEl.value = "";
  autoResize();
  sendMessage(text);
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event("submit"));
  }
});

inputEl.addEventListener("input", autoResize);

function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
}

btnNew.addEventListener("click", () => {
  currentConversationId = null;
  messagesList.innerHTML = "";
  inputEl.focus();
  document.querySelectorAll(".conv-item").forEach((el) => el.classList.remove("active"));
});

function scrollToBottom() {
  messagesList.scrollTop = messagesList.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMarkdown(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(?!<[hup])(.+)$/gm, (m) => m ? `<p>${m}</p>` : m)
    .replace(/<p><\/p>/g, "");
}

loadConversations();
inputEl.focus();
