export interface Transcriber {
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<string>;
}

export class StubTranscriber implements Transcriber {
  async transcribe(_audioBuffer: Buffer, _mimeType: string): Promise<string> {
    return '[Voice message received — transcription not yet configured]';
  }
}
