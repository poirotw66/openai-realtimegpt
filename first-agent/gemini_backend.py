"""
Gemini Live API backend using Python SDK.
Based on plain-js-python-sdk-demo-app/main.py
"""
import asyncio
import base64
import json
import logging
import os
import httpx

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
MCP_PROXY_URL = os.getenv("MCP_PROXY_URL", "http://localhost:3001")

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
    pause_realtime_audio = {"value": False}  # Flag to pause realtime audio during file upload

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
                                
                                # Pause realtime audio input during file upload
                                pause_realtime_audio["value"] = True
                                
                                # Clear any queued realtime audio chunks
                                while not audio_input_queue.empty():
                                    try:
                                        audio_input_queue.get_nowait()
                                    except asyncio.QueueEmpty:
                                        break
                                
                                # Set flag to indicate we're processing an uploaded file
                                is_processing_file["value"] = True
                                logger.info("Processing audio file upload (realtime audio paused)")
                                
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
        
        # Define email tools (FunctionDeclaration format)
        email_tools = [
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name="send_email",
                        description="Send an email to a recipient with a custom subject and body",
                        parameters={
                            "type": "object",
                            "properties": {
                                "receiver_email": {
                                    "type": "string",
                                    "description": "The recipient's email address"
                                },
                                "subject": {
                                    "type": "string",
                                    "description": "The email subject line"
                                },
                                "body": {
                                    "type": "string",
                                    "description": "The email body content"
                                }
                            },
                            "required": ["receiver_email", "subject", "body"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="send_halloween_invitation",
                        description="Send a Halloween party invitation email",
                        parameters={
                            "type": "object",
                            "properties": {
                                "receiver_email": {
                                    "type": "string",
                                    "description": "The recipient's email address"
                                }
                            },
                            "required": ["receiver_email"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="send_system_alert",
                        description="Send a system alert notification email",
                        parameters={
                            "type": "object",
                            "properties": {
                                "receiver_email": {
                                    "type": "string",
                                    "description": "The recipient's email address"
                                }
                            },
                            "required": ["receiver_email"]
                        }
                    )
                ]
            )
        ]
        
        # Enable Google Search grounding (same as GPT Realtime grounded_search tool)
        tools = [types.Tool(google_search=types.GoogleSearch())] + email_tools
        
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Puck"
                    )
                )
            ),
            system_instruction=types.Content(parts=[types.Part(
                text="You are a helpful AI assistant. Keep responses concise and friendly. Respond in Traditional Chinese (繁體中文) when the user speaks Chinese. "
                "When the user asks about time, answer in Taiwan time.\n\n"
                "CRITICAL - Avoid hallucination:\n"
                "- NEVER invent names, statistics, roster/lineup details, or specific facts. If you are not certain, say so and use Google Search to verify.\n"
                "- You have Google Search grounding. You MUST use it when: the user asks about rosters/lineups (e.g. national team 30-man list), current events, sports, specific people, or when the user says 查證/確認/去查.\n"
                "- When the user asks you to verify something (e.g. 去查證、這是誰), always search first, then answer only based on search results. Do not guess or correct with another name you are unsure about.\n"
                "- If search does not clearly support a name or fact, say you could not verify it or that it may be incorrect; do not substitute with another unverified name.\n\n"
                "EMAIL TOOLS - CRITICAL: You MUST use email tools when the user asks to send emails. DO NOT pretend to send emails without actually calling the tool.\n"
                "- send_email: Send a custom email. REQUIRED parameters: receiver_email (recipient's email address), subject (email subject line), body (email content/body). \n"
                "  * When the user asks to send an email (e.g. '幫我寄送郵件給xxx@example.com', 'send email to...', '寄送一個笑話給...'), you MUST IMMEDIATELY call send_email with all required parameters.\n"
                "  * Extract the email address from the user's message. If subject is not provided, create an appropriate one. If body is not provided, create appropriate content based on the user's request.\n"
                "  * Example: User says '寄送一個笑話給 poirotw66@gmail.com' -> Call send_email with receiver_email='poirotw66@gmail.com', subject='一個有趣的笑話', body='[the joke content]'\n"
                "- send_halloween_invitation: Send a Halloween party invitation email. Required parameter: receiver_email. Use ONLY when the user specifically asks for a Halloween invitation.\n"
                "- send_system_alert: Send a system alert notification email. Required parameter: receiver_email. Use ONLY when the user asks for a system alert or notification.\n"
                "IMPORTANT: When you call an email tool, wait for the tool response before telling the user the email was sent. Do NOT say '已經寄出' or 'sent' until you have actually called the tool and received a success response."
            )]),
            tools=tools,
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )
        
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            
            async def send_audio():
                try:
                    while True:
                        chunk = await audio_input_queue.get()
                        # Skip sending if realtime audio is paused (during file upload)
                        if not pause_realtime_audio["value"]:
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
                            try:
                                # Use send_realtime_input for audio with audio_stream_end
                                logger.info(f"Sending audio file with mime_type: {mime_type}, size: {len(audio_data)} bytes")
                                
                                # Send all audio data at once
                                await session.send_realtime_input(
                                    audio=types.Blob(data=audio_data, mime_type=mime_type)
                                )
                                
                                # Signal end of audio stream - tells Gemini the audio is complete
                                await session.send_realtime_input(audio_stream_end=True)
                                
                                logger.info("Audio file sent successfully with audio_stream_end")
                            except Exception as e:
                                logger.error(f"Error sending audio file: {e}", exc_info=True)
                        else:
                            # Regular text input - use send_client_content
                            text = text_or_audio
                            # Send greeting trigger or regular text
                            text_to_send = "你好" if text == "。" else text
                            try:
                                await session.send_client_content(
                                    turns={"role": "user", "parts": [{"text": text_to_send}]},
                                    turn_complete=True
                                )
                            except Exception as e:
                                logger.error(f"Error sending text: {e}", exc_info=True)
                except asyncio.CancelledError:
                    pass

            event_queue = asyncio.Queue()

            async def receive_loop():
                try:
                    while True:
                        async for response in session.receive():
                            # Check for tool calls first (function calling)
                            tool_call = getattr(response, "tool_call", None)
                            if tool_call:
                                function_calls = getattr(tool_call, "function_calls", None) or []
                                logger.info(f"Tool call detected: {len(function_calls)} function(s)")
                                
                                for fc in function_calls:
                                    name = getattr(fc, "name", None) or "(unknown)"
                                    args = getattr(fc, "args", None) or {}
                                    
                                    # Handle email tool calls via MCP proxy
                                    if name in ["send_email", "send_halloween_invitation", "send_system_alert"]:
                                        try:
                                            logger.info(f"Processing email tool: {name}")
                                            async with httpx.AsyncClient(timeout=30.0) as http_client:
                                                http_response = await http_client.post(
                                                    f"{MCP_PROXY_URL}/api/mcp/tools/call",
                                                    json={
                                                        "name": name,
                                                        "arguments": args
                                                    }
                                                )
                                                http_response.raise_for_status()
                                                result = http_response.json()
                                                
                                                if result.get("success"):
                                                    tool_result = result.get("result", {})
                                                    logger.info(f"Email tool {name} succeeded")
                                                    
                                                    function_response = types.FunctionResponse(
                                                        name=name,
                                                        response=tool_result
                                                    )
                                                    await session.send_tool_response(function_responses=[function_response])
                                                else:
                                                    error_msg = result.get("error", "Unknown error")
                                                    logger.error(f"Email tool {name} failed: {error_msg}")
                                                    function_response = types.FunctionResponse(
                                                        name=name,
                                                        response={"success": False, "error": error_msg}
                                                    )
                                                    await session.send_tool_response(function_responses=[function_response])
                                        except httpx.HTTPError as e:
                                            logger.error(f"HTTP error calling email tool {name}: {e}")
                                            function_response = types.FunctionResponse(
                                                name=name,
                                                response={"success": False, "error": f"Network error: {str(e)}"}
                                            )
                                            await session.send_tool_response(function_responses=[function_response])
                                        except Exception as e:
                                            logger.error(f"Error calling email tool {name}: {e}", exc_info=True)
                                            function_response = types.FunctionResponse(
                                                name=name,
                                                response={"success": False, "error": str(e)}
                                            )
                                            await session.send_tool_response(function_responses=[function_response])
                                continue  # Skip processing server_content when we have tool_call
                            
                            server_content = response.server_content
                            
                            if server_content:
                                # Send setup_complete to trigger greeting
                                if hasattr(response, 'setup_complete') and response.setup_complete:
                                    await event_queue.put({"setup_complete": True})
                                
                                if server_content.model_turn:
                                    # Process parts and handle audio output
                                    for part in server_content.model_turn.parts:
                                        # Process audio output
                                        if hasattr(part, "inline_data") and part.inline_data:
                                            await audio_output_callback(part.inline_data.data)
                                # Log grounding metadata when model uses e.g. Google Search
                                gmd = getattr(server_content, "grounding_metadata", None) or getattr(
                                    server_content, "groundingMetadata", None
                                )
                                if gmd:
                                    logger.info("Gemini Live grounding used: %s", gmd)
                                
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
                                                # Resume realtime audio input
                                                pause_realtime_audio["value"] = False
                                                logger.info("Realtime audio input resumed")
                                                # Notify frontend that file processing is complete
                                                await event_queue.put({"server_content": {"file_upload_complete": True}})
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
