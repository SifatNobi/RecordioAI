import { API_BASE_URL } from '@/constants/env';
import { ApiError } from '@/services/api';

export enum TranscriptionErrorCode {
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  HTTP_400 = 'HTTP_400',
  HTTP_401 = 'HTTP_401',
  HTTP_403 = 'HTTP_403',
  HTTP_413 = 'HTTP_413',
  HTTP_415 = 'HTTP_415',
  HTTP_422 = 'HTTP_422',
  HTTP_429 = 'HTTP_429',
  HTTP_500 = 'HTTP_500',
  HTTP_502 = 'HTTP_502',
  HTTP_503 = 'HTTP_503',
  HTTP_504 = 'HTTP_504',
  INVALID_AUDIO = 'INVALID_AUDIO',
  AUDIO_CAPTURE_FAILED = 'AUDIO_CAPTURE_FAILED',
  TRANSCRIPTION_PROVIDER_ERROR = 'TRANSCRIPTION_PROVIDER_ERROR',
  MALFORMED_RESPONSE = 'MALFORMED_RESPONSE',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  EMPTY_TRANSCRIPT = 'EMPTY_TRANSCRIPT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class TranscriptionError extends Error {
  constructor(
    message: string,
    public code: TranscriptionErrorCode,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export interface TranscriptionResult {
  transcript: string;
  language: string;
  confidence: number;
  segments: TranscriptionSegment[];
  provider: string;
  providerId: string;
}

export interface TranscriptionSegment {
  id: string;
  speaker: 'AI_AGENT' | 'CUSTOMER' | 'UNKNOWN';
  speakerConfidence: number;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  words?: WordTimestamp[];
}

export interface WordTimestamp {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptionOptions {
  language?: string;
  speakerDiarization?: boolean;
  punctuate?: boolean;
  profanityFilter?: boolean;
}

const TRANSCRIPTION_TIMEOUT = 180000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

function classifyError(error: unknown): TranscriptionError {
  if (isAbortError(error)) {
    return new TranscriptionError(
      'Request timed out. Please try again.',
      TranscriptionErrorCode.REQUEST_TIMEOUT
    );
  }

  if (error instanceof TypeError && error.message.includes('Network')) {
    return new TranscriptionError(
      'Network unavailable. Check your connection and try again.',
      TranscriptionErrorCode.NETWORK_UNAVAILABLE
    );
  }

  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return new TranscriptionError(
          'Invalid request. The audio file may be corrupted or in an unsupported format.',
          TranscriptionErrorCode.HTTP_400,
          error.status,
          error.details
        );
      case 401:
        return new TranscriptionError(
          'Authentication failed. Please check your credentials.',
          TranscriptionErrorCode.HTTP_401,
          error.status,
          error.details
        );
      case 403:
        return new TranscriptionError(
          'Access denied. You may not have permission to use transcription.',
          TranscriptionErrorCode.HTTP_403,
          error.status,
          error.details
        );
      case 413:
        return new TranscriptionError(
          'Audio file too large. Please record a shorter conversation.',
          TranscriptionErrorCode.HTTP_413,
          error.status,
          error.details
        );
      case 415:
        return new TranscriptionError(
          'This audio format is not supported. Please try a WAV or M4A recording.',
          TranscriptionErrorCode.HTTP_415,
          error.status,
          error.details
        );
      case 422:
        return new TranscriptionError(
          error.message || 'No speech was detected in the recording.',
          TranscriptionErrorCode.HTTP_422,
          error.status,
          error.details
        );
      case 429:
        return new TranscriptionError(
          'Too many requests. Please wait a moment and try again.',
          TranscriptionErrorCode.HTTP_429,
          error.status,
          error.details
        );
      case 500:
        return new TranscriptionError(
          'Transcription service temporarily unavailable. Please try again later.',
          TranscriptionErrorCode.HTTP_500,
          error.status,
          error.details
        );
      case 502:
      case 503:
        return new TranscriptionError(
          error.message || 'Transcription service is not available right now. Please try again later.',
          error.status === 503
            ? TranscriptionErrorCode.HTTP_503
            : TranscriptionErrorCode.HTTP_502,
          error.status,
          error.details
        );
      case 504:
        return new TranscriptionError(
          error.message || 'Transcription timed out. Please try again.',
          TranscriptionErrorCode.HTTP_504,
          error.status,
          error.details
        );
      default:
        return new TranscriptionError(
          error.message || `Request failed with status ${error.status}`,
          TranscriptionErrorCode.UNKNOWN_ERROR,
          error.status,
          error.details
        );
    }
  }

  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      return new TranscriptionError(
        'Request timed out. Please try again.',
        TranscriptionErrorCode.REQUEST_TIMEOUT
      );
    }
    return new TranscriptionError(
      error.message,
      TranscriptionErrorCode.UNKNOWN_ERROR
    );
  }

  return new TranscriptionError(
    'An unknown error occurred during transcription.',
    TranscriptionErrorCode.UNKNOWN_ERROR
  );
}

async function validateAudioFile(fileUri: string): Promise<{ valid: boolean; error?: string; size?: number; duration?: number }> {
  try {
    const { getInfoAsync } = await import('expo-file-system/legacy');
    const normalizedUri = fileUri.startsWith('file:') || fileUri.startsWith('content:') || fileUri.startsWith('asset:')
      ? fileUri
      : `file://${fileUri}`;
    const fileInfo = await getInfoAsync(normalizedUri);

    if (!fileInfo.exists) {
      return { valid: false, error: 'Audio file not found' };
    }

    if (fileInfo.size === 0) {
      return { valid: false, error: 'Audio file is empty' };
    }

    if (fileInfo.size > MAX_AUDIO_BYTES) {
      return { valid: false, error: 'Audio file exceeds 25MB limit' };
    }

    const mimeType = fileUri.split('.').pop()?.toLowerCase();
    const validMimeTypes = ['m4a', 'mp4', 'wav', 'mp3', 'aac', 'ogg', 'webm'];
    if (!mimeType || !validMimeTypes.includes(mimeType)) {
      return { valid: false, error: `Unsupported audio format: ${mimeType}` };
    }

    return { valid: true, size: fileInfo.size };
  } catch {
    return { valid: false, error: 'Failed to validate audio file' };
  }
}

export async function transcribeAudio(
  fileUri: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const validation = await validateAudioFile(fileUri);
  if (!validation.valid) {
    throw new TranscriptionError(
      validation.error || 'Invalid audio file',
      TranscriptionErrorCode.INVALID_AUDIO
    );
  }

  const normalizedUri = fileUri.startsWith('file:') || fileUri.startsWith('content:') || fileUri.startsWith('asset:')
    ? fileUri
    : `file://${fileUri}`;
  const fileName = fileUri.split('/').pop() || 'recording.m4a';
  const mimeType = fileName.endsWith('.wav') ? 'audio/wav' : 'audio/mp4';

  const fields: [string, string][] = [];
  if (options.language) {
    fields.push(['language', options.language]);
  }
  if (options.speakerDiarization !== undefined) {
    fields.push(['speaker_diarization', String(options.speakerDiarization)]);
  }
  if (options.punctuate !== undefined) {
    fields.push(['punctuate', String(options.punctuate)]);
  }
  if (options.profanityFilter !== undefined) {
    fields.push(['profanity_filter', String(options.profanityFilter)]);
  }

  // Expo's WinterCG fetch does not support React Native's legacy FormData
  // `{ uri, name, type }` parts, so the multipart body is built explicitly.
  const { File } = await import('expo-file-system');
  const boundary = `----RecordioAIBoundary_${Math.random().toString(36).slice(2)}`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const pushString = (value: string) => chunks.push(encoder.encode(value));

  for (const [fieldName, fieldValue] of fields) {
    pushString(`--${boundary}\r\n`);
    pushString(`Content-Disposition: form-data; name="${fieldName}"\r\n\r\n`);
    pushString(`${fieldValue}\r\n`);
  }

  pushString(`--${boundary}\r\n`);
  pushString(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
  pushString(`Content-Type: ${mimeType}\r\n\r\n`);
  chunks.push(await new File(normalizedUri).bytes());
  pushString(`\r\n--${boundary}--\r\n`);

  const bodyChunks: Uint8Array[] = [];
  let bodyLength = 0;
  for (const chunk of chunks) {
    bodyChunks.push(chunk);
    bodyLength += chunk.length;
  }
  const body = new Uint8Array(bodyLength);
  let offset = 0;
  for (const chunk of bodyChunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: 'POST',
      body,
      headers: {
        'Accept': 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: { message?: string; detail?: string; code?: string; details?: unknown } = {};
      try {
        errorData = await response.json();
      } catch {
      }
      throw new ApiError(
        errorData.message ||
          errorData.detail ||
          `Transcription failed with status ${response.status}`,
        response.status,
        errorData.code,
        errorData.details
      );
    }

    const data = await response.json();

    if (typeof data.transcript !== 'string' || data.transcript.trim() === '') {
      throw new TranscriptionError(
        'Transcription returned empty result',
        TranscriptionErrorCode.EMPTY_TRANSCRIPT
      );
    }

    return {
      transcript: data.transcript,
      language: data.language || options.language || 'en',
      // Meta does not return a confidence score. Do not invent one.
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      segments: Array.isArray(data.segments) ? data.segments : [],
      provider: data.provider || 'unknown',
      providerId: data.providerId || '',
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError || error instanceof TranscriptionError) {
      throw error;
    }
    throw classifyError(error);
  }
}

export async function retryTranscription(
  fileUri: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  return transcribeAudio(fileUri, options);
}