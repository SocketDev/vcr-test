import { test } from 'tap';
import { join } from 'node:path';
import { RecordMode, VCR } from './index';
import { FileStorage } from "./file-storage";
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Helper functions to match axios API signature, minimizing the diff with the original code
async function fetchPost(url: string, data: string, config?: any) {
  const response = await fetch(url, {
    method: 'POST',
    headers: config?.headers,
    body: data
  });
  return { data: await response.json() };
}

async function fetchGet(url: string, config?: any) {
  const response = await fetch(url, {
    method: 'GET',
    headers: config?.headers
  });
  return { data: await response.json() };
}

async function fetchPut(url: string, data: string, config?: any) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: config?.headers,
    body: data
  });
  return { data: await response.json() };
}

const CASSETTES_DIR = join(__dirname, '__cassettes__');

test('cassette', async (t) => {
  t.test('ClientRequest', async (t) => {
    t.test('records multiple HTTP calls', async (t) => {
      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      vcr.requestMasker = (req) => {
        req.headers['user-agent'] = '****';
      };
      await vcr.useCassette('client_request_multiple_http_calls', async () => {
        await fetchPost('https://httpbin.org/post', JSON.stringify({name: 'alex'}), {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });
  
        await fetchPost('https://httpbin.org/post', JSON.stringify({name: 'yane'}), {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });
      });
      t.pass();
    });

    t.test('records gzipped data as base64', async (t) => {
      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      vcr.requestMasker = (req) => {
        req.headers['user-agent'] = '****';
      };
      await vcr.useCassette('client_request_gzipped_data_stored_as_base64', async () => {
        await fetchGet('https://httpbin.org/gzip', {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });
      });
      t.pass();
    });

    t.test('does not record when request is marked as pass-through', async (t) => {
      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      vcr.requestPassThrough = (req) => {
        return req.url === 'https://httpbin.org/put';
      };
      await vcr.useCassette('client_request_pass_through_calls', async () => {
        await fetchPut('https://httpbin.org/put', JSON.stringify({name: 'alex'}), {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });

        await fetchPost('https://httpbin.org/post', JSON.stringify({name: 'john'}), {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });
      });
      t.pass();
    });

    t.test('records new calls', async (t) => {
      const cassette = join(CASSETTES_DIR, 'client_request_new_calls.yaml');
      if (existsSync(cassette)) {
        await unlink(cassette);
      }

      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      vcr.mode = RecordMode.once;
      await vcr.useCassette('client_request_new_calls', async () => {
        const { data: body } = await fetchPost('https://httpbin.org/post', JSON.stringify({name: 'alex'}), {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });

        t.equal(body.data, '{"name":"alex"}');
      });

      vcr.mode = RecordMode.update;
      await vcr.useCassette('client_request_new_calls', async () => {
        const { data: body} = await fetchPost('https://httpbin.org/post', JSON.stringify({name: 'alex-update'}), {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });
        
        t.equal(body.data, '{"name":"alex-update"}');
      });
    });
  });

  t.test('fetch', async (t) => {
    t.test('records the same HTTP call multiple times', async (t) => {
      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      vcr.requestMasker = (req) => {
        req.headers['user-agent'] = '****';
      };
      await vcr.useCassette('fetch_same_http_call_multiple_times', async () => {
        await fetchPost('https://httpbin.org/post', JSON.stringify({ name: 'alex' }), {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });
  
        await fetchPost('https://httpbin.org/post', JSON.stringify({ name: 'alex' }), {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });
      });
      t.pass();
    });
  
    t.test('records gzipped data as base64', async (t) => {
      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      vcr.requestMasker = (req) => {
        req.headers['user-agent'] = '****';
      };
      await vcr.useCassette('fetch_gzipped_data_stored_as_base64', async () => {
        await fetchGet('https://httpbin.org/gzip', {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });
      });
      t.pass();
    });

    t.test('can record gzip from S3 as base64', async (t) => {
      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      await vcr.useCassette('fetch_gzipped_data_stored_as_base64_from_s3', async () => {
        const res = await fetch('https://crates.io/api/v1/crates/serde/1.0.219/download', {
          headers: {
            'User-Agent': 'UnitTests; raynos2@gmail.com',
          }
        })
        const body = await res.arrayBuffer()
        console.log(body)

        const utf8Text = new TextDecoder().decode(body)
        console.log(utf8Text.slice(0, 100))

        const base64 = Buffer.from(body).toString('base64')
        console.log(base64.slice(0, 100))

        t.equal(base64.slice(0, 10), 'H4sICAAAAA');
        t.equal(base64.slice(-10), '+W2QBgCAA=');
      })
    });

    t.test('can record streaming binary responses as base64', async (t) => {
      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      await vcr.useCassette('fetch_streaming_binary_response', async () => {
        // First request - should record
        const res = await fetch('https://clients2.googleusercontent.com/crx/blobs/AcpJF5gJdVmIuc71j7_wDR9kCVc_J-K-GMI_OOj-fmYLeXil7TFrEluR1ZdVGrLx8bfqtlX0j50U0pBq6-3hSMehXvtWNLpzx7QAGUNrCmYzzepeSTLwAN9ZV4NSfKHPJ74AxlKa5TqjS3FScU6vOXFW5iO62ZqoNDEE/GJJBMFIGJPGNEHJIOICAALOPAIKCNHEO_1_8_0_0.crx', {
          headers: {
            'User-Agent': 'UnitTests; raynos2@gmail.com',
          }
        })

        // Verify it's a binary response
        const contentType = res.headers.get('content-type');
        t.ok(contentType, 'Response should have content-type header');
        console.log('Content-Type:', contentType);
        
        // Test that our binary detection is working
        t.equal(contentType, 'application/x-chrome-extension', 'Content-type should be chrome extension');
        
        // Import the binary detection function to test it directly
        const { isBinary } = require('./cassette');
        t.ok(isBinary(res.headers), 'isBinary should detect chrome extension as binary');

        const body = await res.arrayBuffer()
        console.log('Response size:', body.byteLength, 'bytes');

        // Verify it's stored as base64 in the cassette
        const base64 = Buffer.from(body).toString('base64')
        console.log('Base64 length:', base64.length);

        // Verify it's a valid binary file (should start with common binary signatures)
        t.ok(body.byteLength > 0, 'Response should have content');
        t.ok(base64.length > 0, 'Base64 should not be empty');

        // Test playback - second request should use recorded cassette
        const playbackRes = await fetch('https://clients2.googleusercontent.com/crx/blobs/AcpJF5gJdVmIuc71j7_wDR9kCVc_J-K-GMI_OOj-fmYLeXil7TFrEluR1ZdVGrLx8bfqtlX0j50U0pBq6-3hSMehXvtWNLpzx7QAGUNrCmYzzepeSTLwAN9ZV4NSfKHPJ74AxlKa5TqjS3FScU6vOXFW5iO62ZqoNDEE/GJJBMFIGJPGNEHJIOICAALOPAIKCNHEO_1_8_0_0.crx', {
          headers: {
            'User-Agent': 'UnitTests; raynos2@gmail.com',
          }
        })

        const playbackBody = await playbackRes.arrayBuffer()
        t.equal(playbackBody.byteLength, body.byteLength, 'Playback should return same size');

        // Verify the content is identical
        const originalBuffer = Buffer.from(body);
        const playbackBuffer = Buffer.from(playbackBody);
        t.ok(originalBuffer.equals(playbackBuffer), 'Playback should return identical content');
      })
    });

    t.test('logs warning for large non-binary responses', async (t) => {
      // Test the warning logic directly by importing the function
      const { consumeBody } = require('./cassette');

      // Mock console.warn to capture the warning
      const originalWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (...args: any[]) => {
        warnings.push(args.join(' '));
      };

      // Create a mock response with large content-length
      const mockResponse = {
        headers: {
          get: (name: string) => {
            if (name === 'content-length') return '1048577'; // 1MB + 1 byte
            if (name === 'content-type') return 'application/json';
            return null;
          }
        },
        text: async () => '{"test": "data"}'
      };

      // This should trigger the warning
      await consumeBody(mockResponse);

      // Restore console.warn
      console.warn = originalWarn;

      // Check if warning was logged
      t.ok(warnings.length > 0, 'Should log warning for large non-binary response');
      t.ok(warnings.some(w => w.includes('VCR: Large response detected')), 'Warning should mention VCR and large response');
    });

    t.test('does not record when request is marked as pass-through', async (t) => {
      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      vcr.requestPassThrough = (req) => {
        return req.url === 'https://httpbin.org/put';
      };
      await vcr.useCassette('fetch_pass_through_calls', async () => {
        await fetch('https://httpbin.org/put', {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          method: 'PUT',
          body: JSON.stringify({name: 'alex'})
        });

        await fetchPost('https://httpbin.org/post', JSON.stringify({name: 'alex'}), {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });
      });
      t.pass();
    });

    t.test('records new calls', async (t) => {
      const cassette = join(CASSETTES_DIR, 'fetch_new_calls.yaml');
      if (existsSync(cassette)) {
        await unlink(cassette);
      }

      var vcr = new VCR(new FileStorage(CASSETTES_DIR));
      vcr.mode = RecordMode.once;
      await vcr.useCassette('fetch_new_calls', async () => {
        const body: any = await fetch('https://httpbin.org/post', {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({name: 'alex'})
        }).then(res => res.json());

        t.equal(body.data, '{"name":"alex"}');
      });

      vcr.mode = RecordMode.update;
      await vcr.useCassette('fetch_new_calls', async () => {
        const body: any = await fetch('https://httpbin.org/post', {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({name: 'alex-update'})
        }).then(res => res.json());

        t.equal(body.data, '{"name":"alex-update"}');
      });
    });
  });
});
