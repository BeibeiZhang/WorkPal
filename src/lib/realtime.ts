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

  constructor(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;
  }

  get state() { return this._state; }

  private setState(s: RealtimeState) {
    this._state = s;
    this.callbacks.onStateChange(s);
  }

  async connect(): Promise<void> {
    this.setState('connecting');

    try {
      // 1. Get ephemeral token from our backend
      const tokenRes = await fetch('/api/realtime/token');
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || `Token request failed: ${tokenRes.status}`);
      }
      const session = await tokenRes.json();
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
      this.localStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.localStream!);
      });

      // 5. Set up data channel for events
      this.dc = this.pc.createDataChannel('oai-events');
      this.dc.addEventListener('message', this.handleDataChannelMessage);

      // 6. SDP exchange with OpenAI
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const sdpRes = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpRes.ok) {
        throw new Error(`SDP exchange failed: ${sdpRes.status}`);
      }

      const answerSdp = await sdpRes.text();
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

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
      const msg = err instanceof Error ? err.message : 'Connection failed';
      this.setState('error');
      this.callbacks.onError(msg);
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

  /** Send a text message into the voice conversation (e.g. a URL) */
  sendText(text: string) {
    if (!this.dc || this.dc.readyState !== 'open') return;

    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
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

  /** Disconnect and clean up all resources */
  disconnect() {
    if (this.dc) {
      this.dc.removeEventListener('message', this.handleDataChannelMessage);
      this.dc.close();
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
      this.pc.close();
      this.pc = null;
    }
    this.setState('idle');
  }
}
