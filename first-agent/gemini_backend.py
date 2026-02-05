"""
Gemini Live API backend using Python SDK.
Based on plain-js-python-sdk-demo-app/main.py
"""
import asyncio
import base64
import json
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", os.getenv("PROJECT_ID", ""))
LOCATION = os.getenv("LOCATION", "us-central1")
MODEL = os.getenv("MODEL", "gemini-live-2.5-flash-native-audio")

# Initialize FastAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for Gemini Live."""
    await websocket.accept()

    logger.info("WebSocket connection accepted")

    # Import here to avoid issues if google-genai is not installed
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        await websocket.send_json({"type": "error", "error": "google-genai package not installed"})
        await websocket.close()
        return

    if not PROJECT_ID:
        await websocket.send_json({"type": "error", "error": "GOOGLE_CLOUD_PROJECT not set"})
        await websocket.close()
        return

    audio_input_queue = asyncio.Queue()
    video_input_queue = asyncio.Queue()
    text_input_queue = asyncio.Queue()
    is_processing_file = {"value": False, "timer": None}  # Track if currently processing uploaded file

    async def audio_output_callback(data):
        await websocket.send_bytes(data)

    async def receive_from_client():
        try:
            while True:
                message = await websocket.receive()

                if message.get("bytes"):
                    await audio_input_queue.put(message["bytes"])
                elif message.get("text"):
                    raw_text = message["text"]
                    try:
                        payload = json.loads(raw_text)
                        if isinstance(payload, dict):
                            if payload.get("type") == "image":
                                image_data = base64.b64decode(payload["data"])
                                await video_input_queue.put(image_data)
                                continue
                            # Handle audio file upload (complete file, not streaming)
                            if payload.get("type") == "audio_file":
                                audio_data = base64.b64decode(payload["data"])
                                mime_type = payload.get("mime_type", "audio/pcm;rate=16000")
                                # Set flag to indicate we're processing an uploaded file
                                is_processing_file["value"] = True
                                logger.info("Processing audio file upload")
                                # Put the entire audio into text queue so it's sent via session.send() with end_of_turn
                                await text_input_queue.put({
                                    "audio": audio_data,
                                    "mime_type": mime_type
                                })
                                continue
                            # Client sends user text as {"text": "..."}
                            if "text" in payload:
                                raw_text = payload["text"]
                                await text_input_queue.put(raw_text)
                                continue
                    except json.JSONDecodeError:
                        logger.warning(f"Received non-JSON text: {raw_text[:100]}")
                        pass
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected")
        except Exception as e:
            logger.error(f"Error receiving from client: {e}")

    receive_task = asyncio.create_task(receive_from_client())

    async def run_session():
        client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
        
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Puck"
                    )
                )
            ),
            system_instruction=types.Content(parts=[types.Part(text="You are a helpful AI assistant. Keep your responses concise and friendly. Respond in Traditional Chinese (繁體中文) when the user speaks Chinese.")]),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )
        
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            
            async def send_audio():
                try:
                    while True:
                        chunk = await audio_input_queue.get()
                        await session.send_realtime_input(
                            audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
                        )
                except asyncio.CancelledError:
                    pass

            async def send_video():
                try:
                    while True:
                        chunk = await video_input_queue.get()
                        await session.send_realtime_input(
                            video=types.Blob(data=chunk, mime_type="image/jpeg")
                        )
                except asyncio.CancelledError:
                    pass

            async def send_text():
                try:
                    while True:
                        text_or_audio = await text_input_queue.get()
                        # Handle audio file upload
                        if isinstance(text_or_audio, dict) and "audio" in text_or_audio:
                            audio_data = text_or_audio["audio"]
                            mime_type = text_or_audio["mime_type"]
                            # Send audio as a turn with end_of_turn=True so Gemini waits for complete audio
                            await session.send(
                                input=types.Blob(data=audio_data, mime_type=mime_type),
                                end_of_turn=True
                            )
                        else:
                            # Regular text input
                            text = text_or_audio
                            # Send greeting trigger
                            if text == "。":
                                await session.send(input="你好", end_of_turn=True)
                            else:
                                await session.send(input=text, end_of_turn=True)
                except asyncio.CancelledError:
                    pass

            event_queue = asyncio.Queue()

            async def receive_loop():
                try:
                    while True:
                        async for response in session.receive():
                            server_content = response.server_content
                            
                            if server_content:
                                # Send setup_complete to trigger greeting
                                if hasattr(response, 'setup_complete') and response.setup_complete:
                                    await event_queue.put({"setup_complete": True})
                                
                                if server_content.model_turn:
                                    for part in server_content.model_turn.parts:
                                        if part.inline_data:
                                            await audio_output_callback(part.inline_data.data)
                                
                                if server_content.input_transcription and server_content.input_transcription.text:
                                    await event_queue.put({
                                        "server_content": {
                                            "input_transcription": {
                                                "text": server_content.input_transcription.text,
                                                "is_from_file": is_processing_file["value"]
                                            }
                                        }
                                    })
                                
                                if server_content.output_transcription:
                                    await event_queue.put({
                                        "server_content": {
                                            "output_transcription": {
                                                "text": server_content.output_transcription.text,
                                                "finished": getattr(server_content.output_transcription, 'finished', False)
                                            }
                                        }
                                    })
                                
                                if server_content.turn_complete:
                                    # Delay resetting file processing flag to catch all transcription segments
                                    if is_processing_file["value"]:
                                        # Cancel previous timer if exists
                                        if is_processing_file["timer"]:
                                            is_processing_file["timer"].cancel()
                                        # Set new timer to reset after 2 seconds of no activity
                                        async def reset_file_flag():
                                            await asyncio.sleep(2)
                                            if is_processing_file["value"]:
                                                logger.info("Audio file processing complete (delayed)")
                                                is_processing_file["value"] = False
                                                is_processing_file["timer"] = None
                                        is_processing_file["timer"] = asyncio.create_task(reset_file_flag())
                                    await event_queue.put({"server_content": {"turn_complete": True}})
                                
                                if server_content.interrupted:
                                    await event_queue.put({"server_content": {"interrupted": True}})

                except Exception as e:
                    await event_queue.put({"type": "error", "error": str(e)})
                finally:
                    await event_queue.put(None)

            send_audio_task = asyncio.create_task(send_audio())
            send_video_task = asyncio.create_task(send_video())
            send_text_task = asyncio.create_task(send_text())
            receive_task_inner = asyncio.create_task(receive_loop())

            try:
                while True:
                    event = await event_queue.get()
                    if event is None:
                        break
                    if isinstance(event, dict):
                        await websocket.send_json(event)
                        if event.get("type") == "error":
                            break
            finally:
                send_audio_task.cancel()
                send_video_task.cancel()
                send_text_task.cancel()
                receive_task_inner.cancel()

    try:
        await run_session()
    except Exception as e:
        logger.error(f"Error in Gemini session: {e}")
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except:
            pass
    finally:
        receive_task.cancel()
        try:
            await websocket.close()
        except:
            pass


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
