import { setTimeout } from 'node:timers/promises';
import { Base64EncodeBody, HttpRequestMasker, ICassetteStorage, IRequestMatcher, PassThroughHandler, RecordMode } from './types';
import { DefaultRequestMatcher } from './default-request-matcher';
import { Cassette, defaultBase64EncodeBody } from './cassette';

const ENV_TO_RECORD_MODE: Record<string, RecordMode> = {
  [RecordMode.none]: RecordMode.none,
  [RecordMode.once]: RecordMode.once,
  [RecordMode.all]: RecordMode.all,
  [RecordMode.update]: RecordMode.update,
} as const;

export class VCR {

  public matcher: IRequestMatcher = new DefaultRequestMatcher();
  public requestMasker: HttpRequestMasker = () => {};
  public requestPassThrough?: PassThroughHandler;
  public mode: RecordMode = RecordMode.once;
  public base64EncodeBody: Base64EncodeBody = defaultBase64EncodeBody;

  constructor (private readonly storage: ICassetteStorage) {}

  public async useCassette(name: string, action: () => Promise<void>) {
    const mode = ENV_TO_RECORD_MODE[process.env['VCR_MODE'] ?? this.mode] ?? this.mode;

    var cassette = new Cassette(this.storage, this.matcher, name, mode, this.requestMasker, this.requestPassThrough, this.base64EncodeBody);
    await cassette.mount();
    try {
      await action();
      let waited = 0;
      while (!cassette.isDone() && waited < 10_000) {
        waited += 50;
        await setTimeout(50);
      }
    } finally {
      await cassette.eject();
    }
  }
}
