import { GoogleSheetsAdapter } from '../../infrastructure/adapters/GoogleSheetsAdapter';
import * as crypto from 'crypto';

let httpResponseData = '';
let httpStatusCode = 200;
let lastPostData = '';

jest.mock('https', () => ({
  request: (url: any, options: any, callback: any) => {
    const res = {
      statusCode: httpStatusCode,
      on: (event: string, cb: any) => {
        if (event === 'data') cb(httpResponseData);
        if (event === 'end') cb();
      }
    };
    if (callback) callback(res);
    return {
      on: jest.fn(),
      write: (d: string) => { lastPostData = d; },
      end: jest.fn()
    };
  }
}));

describe("GoogleSheetsAdapter", () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  beforeEach(() => {
    httpResponseData = '{"access_token":"token123","values":[["val1"]]}';
    httpStatusCode = 200;
    lastPostData = '';
  });

  it("Debería enviar datos via Webhook exitosamente", async () => {
    const adapter = new GoogleSheetsAdapter({
      webhookUrl: "https://script.google.com/macros/s/xyz/exec"
    });
    httpStatusCode = 200;
    httpResponseData = JSON.stringify({ status: "ok" });

    const res = await adapter.appendRow("Sheet1", ["val1", "val2"]);
    expect(res).toBe(true);
  });

  it("Debería lanzar error si Webhook responde con status de error", async () => {
    const adapter = new GoogleSheetsAdapter({
      webhookUrl: "https://script.google.com/macros/s/xyz/exec"
    });
    httpStatusCode = 500;
    httpResponseData = "Webhook error";

    await expect(adapter.appendRow("Sheet1", ["val1"])).rejects.toThrow(/Error Webhook \(500\)/);
  });

  it("Debería hacer appendRow via Service Account OAuth2", async () => {
    const adapter = new GoogleSheetsAdapter({
      spreadsheetId: "sheet123",
      clientEmail: "bot@domain.iam.gserviceaccount.com",
      privateKey: privateKey
    });
    httpStatusCode = 200;
    httpResponseData = JSON.stringify({ access_token: "token123" });

    const res = await adapter.appendRow("Contactos", ["test"]);
    expect(res).toBe(true);
  });

  it("Debería leer filas via Service Account", async () => {
    const adapter = new GoogleSheetsAdapter({
      spreadsheetId: "sheet123",
      clientEmail: "bot@domain.iam.gserviceaccount.com",
      privateKey: privateKey
    });
    httpStatusCode = 200;
    httpResponseData = JSON.stringify({ values: [["r1", "r2"]] });

    const rows = await adapter.readRows("Contactos");
    expect(rows).toEqual([["r1", "r2"]]);
  });

  it("Debería lanzar error ante fallo de autenticación OAuth", async () => {
    const adapter = new GoogleSheetsAdapter({
      spreadsheetId: "sheet123",
      clientEmail: "bot@domain.iam.gserviceaccount.com",
      privateKey: privateKey
    });
    httpStatusCode = 401;
    httpResponseData = "Invalid Credentials";

    await expect(adapter.appendRow("Contactos", ["data"])).rejects.toThrow(/Error OAuth \(401\)/);
  });
});
