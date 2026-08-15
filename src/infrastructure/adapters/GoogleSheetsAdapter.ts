import * as crypto from 'crypto';
import * as https from 'https';
import { ErrorHandler } from '../logging/ErrorHandler';

export interface GoogleSheetsAdapterConfig {
  spreadsheetId?: string;
  clientEmail?: string;
  privateKey?: string;
}

export class GoogleSheetsAdapter {
  private spreadsheetId: string;
  private clientEmail: string;
  private privateKey: string;

  constructor(config: GoogleSheetsAdapterConfig = {}) {
    this.spreadsheetId = config.spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID || '';
    this.clientEmail = config.clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    this.privateKey = (config.privateKey || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  }

  /**
   * Genera un token JWT firmado para autenticación RS256 con la API de Google.
   */
  private generateJwtToken(): string {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const base64UrlEncode = (obj: object): string => {
      return Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    };

    const encodedHeader = base64UrlEncode(header);
    const encodedClaimSet = base64UrlEncode(claimSet);
    const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(this.privateKey, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${signatureInput}.${signature}`;
  }

  /**
   * Obtiene un Access Token de la API OAuth2 de Google usando el JWT de la Service Account.
   */
  private async getAccessToken(): Promise<string> {
    const jwtToken = this.generateJwtToken();
    const postData = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwtToken}`;

    return new Promise((resolve, reject) => {
      const req = https.request('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(data);
              resolve(json.access_token);
            } catch (err) {
              reject(new Error(`Error al parsear respuesta OAuth: ${err}`));
            }
          } else {
            reject(new Error(`Error OAuth (${res.statusCode}): ${data}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(postData);
      req.end();
    });
  }

  /**
   * Agrega una fila de datos a la pestaña indicada en Google Sheets (Escribir).
   */
  public async appendRow(sheetName: string, values: string[]): Promise<boolean> {

    if (this.spreadsheetId && this.clientEmail && this.privateKey) {
      try {
        const accessToken = await this.getAccessToken();
        const range = `${encodeURIComponent(sheetName)}!A:A`;
        const postData = JSON.stringify({
          values: [values]
        });

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

        return new Promise((resolve, reject) => {
          const req = https.request(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                ErrorHandler.logSystem('GoogleSheetsAdapter', `Fila guardada exitosamente en Google Sheets (${sheetName})`);
                resolve(true);
              } else {
                ErrorHandler.handle('GoogleSheetsAdapter', new Error(`Google API Error (${res.statusCode}): ${data}`));
                reject(new Error(`Google API Error (${res.statusCode}): ${data}`));
              }
            });
          });

          req.on('error', (err) => reject(err));
          req.write(postData);
          req.end();
        });
      } catch (error) {
        ErrorHandler.handle('GoogleSheetsAdapter', error, { sheetName, action: 'appendRow' });
        throw error;
      }
    }

    ErrorHandler.logSystem('GoogleSheetsAdapter', `DRY RUN: Hoja '${sheetName}' -> Valores: ${JSON.stringify(values)}`);
    return false;
  }

  /**
   * Lee las filas de una pestaña indicada de la hoja de Google (Leer).
   */
  public async readRows(sheetName: string, range: string = 'A:Z'): Promise<string[][]> {
    if (!this.spreadsheetId || !this.clientEmail || !this.privateKey) {
      throw new Error('[GoogleSheetsAdapter] Para leer sobre la hoja de Google se requiere spreadsheetId, clientEmail y privateKey.');
    }

    try {
      const accessToken = await this.getAccessToken();
      const fullRange = `${encodeURIComponent(sheetName)}!${range}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${fullRange}?majorDimension=ROWS`;

      return new Promise((resolve, reject) => {
        const req = https.request(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const json = JSON.parse(data);
                resolve(json.values || []);
              } catch (err) {
                reject(new Error(`Error parseando filas de Google Sheets: ${err}`));
              }
            } else {
              reject(new Error(`Google API Error (${res.statusCode}): ${data}`));
            }
          });
        });

        req.on('error', (err) => reject(err));
        req.end();
      });
    } catch (error) {
      console.error(`[GoogleSheetsAdapter] Error al leer desde la API de Google Sheets:`, error);
      throw error;
    }
  }
}
