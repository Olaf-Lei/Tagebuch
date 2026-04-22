import json
import os
import uuid
from datetime import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

SYSTEM_PROMPT = Path("system_prompt.md").read_text(encoding="utf-8")
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    conversation_id: str | None = None
    message: str


def load_conversation(conversation_id: str) -> list[dict]:
    path = DATA_DIR / f"{conversation_id}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def save_conversation(conversation_id: str, messages: list[dict]) -> None:
    path = DATA_DIR / f"{conversation_id}.json"
    path.write_text(json.dumps(messages, ensure_ascii=False, indent=2), encoding="utf-8")


def list_conversations() -> list[dict]:
    conversations = []
    for path in sorted(DATA_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        messages = json.loads(path.read_text(encoding="utf-8"))
        if not messages:
            continue
        first_user = next((m["content"] for m in messages if m["role"] == "user"), "")
        conversations.append({
            "id": path.stem,
            "preview": first_user[:80],
            "updated_at": datetime.fromtimestamp(path.stat().st_mtime).strftime("%d.%m.%Y %H:%M"),
            "message_count": len(messages),
        })
    return conversations


@app.get("/api/conversations")
def get_conversations():
    return list_conversations()


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    messages = load_conversation(conversation_id)
    if not messages:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    return {"id": conversation_id, "messages": messages}


@app.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    path = DATA_DIR / f"{conversation_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    path.unlink()
    return {"ok": True}


@app.post("/api/chat")
def chat(req: ChatRequest):
    conversation_id = req.conversation_id or str(uuid.uuid4())
    messages = load_conversation(conversation_id)
    messages.append({"role": "user", "content": req.message})

    def stream():
        full_response = ""
        with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                full_response += text
                yield f"data: {json.dumps({'text': text, 'conversation_id': conversation_id})}\n\n"

        messages.append({"role": "assistant", "content": full_response})
        save_conversation(conversation_id, messages)
        yield f"data: {json.dumps({'done': True, 'conversation_id': conversation_id})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


app.mount("/", StaticFiles(directory="static", html=True), name="static")
