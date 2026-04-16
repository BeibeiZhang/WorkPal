/**
 * OpenAI Realtime API — WebRTC connection manager.
 *
 * Flow:
 * 1. GET /api/realtime/token → ephemeral key
 * 2. RTCPeerConnection → SDP offer/answer with OpenAI
 * 3. Audio tracks for mic input / AI output
 * 4. DataChannel for events (transcripts, function calls)
 */

export type RealtimeState = 'idle' | 'connecting' | 'connected' | 'error';

export type VoiceGender = 'male' | 'female';

export const VOICE_OPTIONS = [
  { id: 'alloy',   gender: 'female', short: 'Neutral',     hint: 'Neutral, versatile' },
  { id: 'coral',   gender: 'female', short: 'Bright',      hint: 'Bright, friendly' },
  { id: 'sage',    gender: 'female', short: 'Measured',    hint: 'Measured, thoughtful' },
  { id: 'shimmer', gender: 'female', short: 'Crisp',       hint: 'Crisp, upbeat' },
  { id: 'ash',     gender: 'male',   short: 'Deep',        hint: 'Deep, grounded' },
  { id: 'ballad',  gender: 'male',   short: 'Warm',        hint: 'Warm, soft' },
  { id: 'echo',    gender: 'male',   short: 'Smooth',      hint: 'Smooth, calm' },
  { id: 'verse',   gender: 'male',   short: 'Expressive',  hint: 'Expressive, lively' },
] as const;
export type VoiceId = (typeof VOICE_OPTIONS)[number]['id'];

export interface TranscriptEvent {
  role: 'user' | 'assistant';
  text: string;
  isFinal: boolean;
}

export interface RealtimeCallbacks {
  onStateChange: (state: RealtimeState) => void;
  onTranscript: (event: TranscriptEvent) => void;
  onAudioStart: () => void;
  onAudioEnd: () => void;
  onError: (message: string) => void;
}

export class RealtimeSession {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private localStream: MediaStream | null = null;
  private callbacks: RealtimeCallbacks;
  private _state: RealtimeState = 'idle';
  /** Set by disconnect(). connect() checks after every await so an in-flight
   *  handshake (token fetch, mic prompt, SDP exchange) is abandoned cleanly
   *  when React StrictMode tears the session down between its double-mount. */
  private disposed = false;

  constructor(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;
  }

  get state() { return this._state; }

  private setState(s: RealtimeState) {
    if (this.disposed) return;
    this._state = s;
    this.callbacks.onStateChange(s);
  }

  async connect(voice?: VoiceId): Promise<void> {
    if (this.disposed) return;
    this.setState('connecting');

    try {
      // 1. Get ephemeral token from our backend
      const tokenUrl = voice ? `/api/realtime/token?voice=${encodeURIComponent(voice)}` : '/api/realtime/token';
      const tokenRes = await fetch(tokenUrl);
      if (this.disposed) return;
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || `Token request failed: ${tokenRes.status}`);
      }
      const session = await tokenRes.json();
      if (this.disposed) return;
      const ephemeralKey = session.client_secret?.value;
      if (!ephemeralKey) {
        throw new Error('No ephemeral key returned from server');
      }

      // 2. Create peer connection
      this.pc = new RTCPeerConnection();

      // 3. Set up remote audio playback
      this.audioEl = document.createElement('audio');
      this.audioEl.autoplay = true;
      this.pc.ontrack = (e) => {
        if (this.audioEl) {
          this.audioEl.srcObject = e.streams[0];
        }
      };

      // 4. Add local microphone (with explicit permission error handling)
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr) {
        const name = micErr instanceof DOMException ? micErr.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          throw new Error('Microphone permission denied. Please allow microphone access and try again.');
        }
        throw new Error('Could not access microphone: ' + (micErr instanceof Error ? micErr.message : 'unknown error'));
      }
      if (this.disposed) { this.cleanupResources(); return; }
      this.localStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.localStream!);
      });

      // 5. Set up data channel for events
      this.dc = this.pc.createDataChannel('oai-events');
      this.dc.addEventListener('message', this.handleDataChannelMessage);

      // 6. SDP exchange with OpenAI
      const offer = await this.pc.createOffer();
      if (this.disposed) { this.cleanupResources(); return; }
      await this.pc.setLocalDescription(offer);
      if (this.disposed) { this.cleanupResources(); return; }

      const sdpRes = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      });
      if (this.disposed) { this.cleanupResources(); return; }

      if (!sdpRes.ok) {
        throw new Error(`SDP exchange failed: ${sdpRes.status}`);
      }

      const answerSdp = await sdpRes.text();
      if (this.disposed) { this.cleanupResources(); return; }
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      if (this.disposed) { this.cleanupResources(); return; }

      // 7. Monitor connection state
      this.pc.onconnectionstatechange = () => {
        if (this.pc?.connectionState === 'connected') {
          this.setState('connected');
        } else if (this.pc?.connectionState === 'failed' || this.pc?.connectionState === 'disconnected') {
          this.setState('error');
          this.callbacks.onError('Connection lost');
        }
      };

    } catch (err) {
      if (this.disposed) return;
      const msg = err instanceof Error ? err.message : 'Connection failed';
      this.setState('error');
      this.callbacks.onError(msg);
    }
  }

  private cleanupResources() {
    if (this.dc) {
      this.dc.removeEventListener('message', this.handleDataChannelMessage);
      try { this.dc.close(); } catch { /* already closed */ }
      this.dc = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
      this.audioEl.remove();
      this.audioEl = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch { /* already closed */ }
      this.pc = null;
    }
  }

  private handleDataChannelMessage = (e: MessageEvent) => {
    try {
      const event = JSON.parse(e.data);

      switch (event.type) {
        // User's speech transcription
        case 'conversation.item.input_audio_transcription.completed':
          this.callbacks.onTranscript({
            role: 'user',
            text: event.transcript || '',
            isFinal: true,
          });
          break;

        // AI response text (delta)
        case 'response.audio_transcript.delta':
          this.callbacks.onTranscript({
            role: 'assistant',
            text: event.delta || '',
            isFinal: false,
          });
          break;

        // AI response text (complete)
        case 'response.audio_transcript.done':
          this.callbacks.onTranscript({
            role: 'assistant',
            text: event.transcript || '',
            isFinal: true,
          });
          break;

        // AI started speaking
        case 'response.audio.delta':
          if (event.delta) {
            this.callbacks.onAudioStart();
          }
          break;

        // AI finished responding
        case 'response.done':
          this.callbacks.onAudioEnd();
          break;

        // Function call completed — AI wants to call a tool
        case 'response.function_call_arguments.done':
          this.handleFunctionCall(event);
          break;

        // Handle errors
        case 'error':
          this.callbacks.onError(event.error?.message || 'Realtime API error');
          break;
      }
    } catch {
      // Ignore unparseable messages
    }
  };

  /** Execute a function call from the AI and return the result */
  private async handleFunctionCall(event: { call_id: string; name: string; arguments: string }) {
    if (!this.dc || this.dc.readyState !== 'open') return;

    const { call_id, name, arguments: argsStr } = event;
    let result = '';

    try {
      const args = JSON.parse(argsStr);

      if (name === 'browse_url' && args.url) {
        // Fetch the webpage via our backend
        const res = await fetch('/api/browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: args.url }),
        });
        const data = await res.json();
        result = data.title
          ? `Page title: ${data.title}\n\nContent:\n${data.content}`
          : data.content;
      } else {
        result = `Unknown function: ${name}`;
      }
    } catch {
      result = 'Failed to execute function';
    }

    // Send function output back to the AI
    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id,
        output: result,
      },
    }));

    // Trigger the AI to respond with the function result
    this.dc.send(JSON.stringify({ type: 'response.create' }));
  }

  /** Send a text + optional image message into the voice conversation.
   *  Images are sent as `input_image` content parts with data URLs so the
   *  vision-capable realtime model can see attachments the user dropped into
   *  ChatInput while voice mode is active. */
  sendText(text: string, images: string[] = []) {
    if (!this.dc || this.dc.readyState !== 'open') return;
    const content: Array<Record<string, unknown>> = [];
    if (text) content.push({ type: 'input_text', text });
    for (const url of images) content.push({ type: 'input_image', image_url: url });
    if (content.length === 0) return;

    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content,
      },
    }));
    // Trigger a response
    this.dc.send(JSON.stringify({ type: 'response.create' }));
  }

  /** Toggle microphone mute */
  toggleMute(): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return !track.enabled; // returns true if now muted
    }
    return false;
  }

  /** Disconnect and clean up all resources. Safe to call while connect()
   *  is still in flight — sets `disposed` so the in-flight handshake bails
   *  at its next checkpoint. */
  disconnect() {
    this.disposed = true;
    this.cleanupResources();
    this._state = 'idle';
  }
}
