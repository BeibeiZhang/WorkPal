/**
 * OpenAI Realtime API — WebRTC connection manager.
 *
 * Flow:
 * 1. GET /api/realtime/token → ephemeral key
 * 2. RTCPeerConnection → SDP offer/answer with OpenAI
 * 3. Audio tracks for mic input / AI output
 * 4. DataChannel for events (transcripts, function calls)
 */

import type { ImageResult, VideoResult, WebResult } from '../types';
import { logClientUsage, realtimeCostUsd } from './usage';

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
  /** Fired when the AI invokes the search_images tool — results are rendered
   *  into the chat as an assistant message with imageResults populated. */
  onImages?: (query: string, images: ImageResult[]) => void;
  /** Fired when the AI invokes the search_videos tool — results are rendered
   *  into the chat as an assistant message with videoResults populated. */
  onVideos?: (query: string, videos: VideoResult[]) => void;
  /** Fired when the AI invokes web_search — an assistant message is appended
   *  with webResults (source chips) and optional imageResults (product photo
   *  pulled from the Tavily response). */
  onWebSearch?: (query: string, results: WebResult[], images: ImageResult[]) => void;
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
        case 'response.done': {
          this.callbacks.onAudioEnd();
          // Voice mode bills on audio + text tokens at very different rates;
          // OpenAI reports the breakdown once per response in `response.usage`.
          // Logging here keeps the Overview dashboard honest about how much
          // a voice session actually costs (usually 10-20x a text session).
          const usage = event.response?.usage as undefined | {
            input_tokens?: number;
            output_tokens?: number;
            input_token_details?: { text_tokens?: number; audio_tokens?: number; cached_tokens?: number };
            output_token_details?: { text_tokens?: number; audio_tokens?: number };
          };
          if (usage) {
            const cost = realtimeCostUsd(usage);
            if (cost > 0) {
              void logClientUsage({
                provider: 'openai',
                model: 'gpt-4o-realtime-preview',
                capability: 'voice',
                input_tokens: usage.input_tokens ?? 0,
                output_tokens: usage.output_tokens ?? 0,
                cache_read_tokens: usage.input_token_details?.cached_tokens,
                cost_usd: cost,
              });
            }
          }
          break;
        }

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
      } else if (name === 'search_images' && args.query) {
        // Fetch photos via our backend, render them into the chat, and
        // report back to the AI so it can keep speaking naturally.
        const res = await fetch('/api/search-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: args.query, count: args.count }),
        });
        const data = await res.json();
        const images: ImageResult[] = Array.isArray(data?.images) ? data.images : [];
        if (images.length > 0) {
          this.callbacks.onImages?.(args.query, images);
          result = `Displayed ${images.length} photo${images.length === 1 ? '' : 's'} for "${args.query}" in the chat. Continue the conversation naturally — do NOT list URLs or re-describe each photo; briefly reference that you've shown them and move on.`;
        } else {
          result = `No photos found for "${args.query}". Tell the user you couldn't find suitable photos and offer to try a different query.`;
        }
      } else if (name === 'search_videos' && args.query) {
        const res = await fetch('/api/search-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: args.query, count: args.count }),
        });
        const data = await res.json();
        const videos: VideoResult[] = Array.isArray(data?.videos) ? data.videos : [];
        if (videos.length > 0) {
          this.callbacks.onVideos?.(args.query, videos);
          result = `Displayed ${videos.length} YouTube video${videos.length === 1 ? '' : 's'} for "${args.query}" in the chat. Continue naturally — do NOT read out URLs or titles; briefly reference that you've shown the videos and move on.`;
        } else {
          result = `No YouTube videos found for "${args.query}". Tell the user and offer to try a different query.`;
        }
      } else if (name === 'web_search' && args.query) {
        // Web search for prices/facts. Unlike text mode (which runs a second
        // LLM pass to synthesize), voice mode passes the raw result snippets
        // back as the function output — the realtime model reads them in its
        // next spoken turn. Results + the first inline image render as a
        // standalone assistant message so the user sees source chips and a
        // product photo while the AI speaks the answer.
        const res = await fetch('/api/search-web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: args.query, max_results: args.max_results }),
        });
        const data = await res.json();
        const results: WebResult[] = Array.isArray(data?.results) ? data.results : [];
        const imageUrls: string[] = Array.isArray(data?.images) ? data.images : [];
        if (results.length > 0) {
          const images: ImageResult[] = imageUrls[0]
            ? [{
                url: imageUrls[0],
                thumbUrl: imageUrls[0],
                alt: 'Search result image',
                sourceUrl: results[0].url,
                attribution: results[0].title,
              }]
            : [];
          this.callbacks.onWebSearch?.(args.query, results, images);
          const condensed = results.slice(0, 5).map((r, i) => `${i + 1}. ${r.title}\n${r.content.slice(0, 500)}\nSource: ${r.url}`).join('\n\n');
          result = `Web search results for "${args.query}" (source chips are already displayed in the chat — do NOT read out URLs aloud). Summarize the key facts in the user's language:\n\n${condensed}`;
        } else {
          result = `No web results found for "${args.query}". Tell the user and ask whether to refine the query.`;
        }
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
