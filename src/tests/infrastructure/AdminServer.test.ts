import { AdminServer } from '../../infrastructure/web/AdminServer';
import { WhatsAppAdapter } from '../../infrastructure/adapters/WhatsAppAdapter';
import { AppConfig } from '../../config/config';
import * as http from 'http';

describe('AdminServer Test Suite', () => {
  let mockWhatsAppAdapter: Partial<WhatsAppAdapter>;
  let mockConfig: AppConfig;
  let adminServer: AdminServer;

  beforeEach(() => {
    mockWhatsAppAdapter = {
      getStatus: jest.fn().mockReturnValue('WAITING_QR'),
      getQR: jest.fn().mockReturnValue('test-qr-code-data'),
      getConnectedUser: jest.fn().mockReturnValue(null),
      resetAccount: jest.fn().mockResolvedValue(undefined),
      updateSessionConfig: jest.fn()
    };

    mockConfig = {
      interface: 'baileys',
      inputAdapter: 'file',
      flowFile: 'flow_cfp412.json',
      leadsStorage: { type: 'csv' },
      adminWeb: {
        enabled: true,
        port: 0, // Usar puerto dinámico para pruebas
        password: 'testpassword123'
      }
    };

    adminServer = new AdminServer(mockConfig, mockWhatsAppAdapter as WhatsAppAdapter);
  });

  afterEach(async () => {
    await adminServer.stop();
    jest.clearAllMocks();
  });

  function makeRequest(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: any
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      // Acceder al servidor interno levantado
      const serverInstance = (adminServer as any).server;
      if (!serverInstance) {
        return reject(new Error('Servidor no iniciado'));
      }

      const address = serverInstance.address();
      const port = typeof address === 'object' ? address.port : 0;

      const requestBody = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
      headers['Connection'] = 'close';
      if (body && typeof body === 'object') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }
      headers['Content-Length'] = String(Buffer.byteLength(requestBody));

      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          method,
          path,
          headers
        },
        (res) => {
          let responseBody = '';
          res.on('data', (chunk) => {
            responseBody += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 500,
              headers: res.headers,
              body: responseBody
            });
          });
        }
      );

      req.on('error', (err) => reject(err));
      if (requestBody) {
        req.write(requestBody);
      }
      req.end();
    });
  }

  it('debería responder 200 en GET /login', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/login');
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Panel Administrativo');
  });

  it('debería rechazar login con contraseña incorrecta', async () => {
    await adminServer.start();
    const res = await makeRequest(
      'POST',
      '/login',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'password=wrongpassword'
    );
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain('Contraseña incorrecta');
  });

  it('debería autenticar correctamente con la contraseña válida', async () => {
    await adminServer.start();
    const res = await makeRequest(
      'POST',
      '/login',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'password=testpassword123'
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie']![0]).toContain('admin_session=testpassword123');
  });

  it('debería redirigir al login si se accede a / sin estar autenticado', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('debería mostrar el dashboard si se accede a / con cookie válida', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Gestión de WhatsApp Bot');
  });

  it('debería retornar el estado y el QR DataURL en GET /api/status con autenticación', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/api/status', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.status).toBe('WAITING_QR');
    expect(data.qrDataUrl).toContain('data:image/png;base64');
  });

  it('debería retornar el estado CONNECTED sin qrDataUrl en GET /api/status', async () => {
    (mockWhatsAppAdapter.getStatus as jest.Mock).mockReturnValue('CONNECTED');
    (mockWhatsAppAdapter.getQR as jest.Mock).mockReturnValue(null);
    (mockWhatsAppAdapter.getConnectedUser as jest.Mock).mockReturnValue('5491100000000@s.whatsapp.net');

    await adminServer.start();
    const res = await makeRequest('GET', '/api/status', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.status).toBe('CONNECTED');
    expect(data.qrDataUrl).toBeNull();
    expect(data.connectedUser).toBe('5491100000000@s.whatsapp.net');
  });

  it('debería invocar resetAccount en POST /api/reset', async () => {
    await adminServer.start();
    const res = await makeRequest(
      'POST',
      '/api/reset',
      { Cookie: 'admin_session=testpassword123' }
    );
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(mockWhatsAppAdapter.resetAccount).toHaveBeenCalled();
  });

  it('debería hacer logout y eliminar la cookie de sesión', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/logout');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
    expect(res.headers['set-cookie']![0]).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('debería redirigir a / si ya está autenticado e ingresa a /login', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/login', {
      Cookie: 'admin_session=testpassword123; foo=bar'
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  it('debería responder 401 No autorizado en llamadas a /api/ sin cookie válida', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/api/status');
    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('No autorizado');
  });

  it('debería responder 500 si ocurre una excepción en /api/status', async () => {
    (mockWhatsAppAdapter.getStatus as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Error simulado en getStatus');
    });
    await adminServer.start();
    const res = await makeRequest('GET', '/api/status', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(500);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('Error al obtener estado del bot');
  });

  it('debería responder 500 si ocurre una excepción en /api/reset', async () => {
    (mockWhatsAppAdapter.resetAccount as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Error simulado en resetAccount');
    });
    await adminServer.start();
    const res = await makeRequest('POST', '/api/reset', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(500);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('Error al procesar el reseteo de la cuenta');
  });

  it('debería resolver stop sin error si el servidor no está iniciado', async () => {
    const unstartedServer = new AdminServer(mockConfig, mockWhatsAppAdapter as WhatsAppAdapter);
    await expect(unstartedServer.stop()).resolves.toBeUndefined();
  });

  it('debería usar puerto y contraseña por defecto si config.adminWeb es indefinido', () => {
    const defaultConfig: AppConfig = {
      interface: 'baileys',
      inputAdapter: 'file',
      flowFile: 'flow_cfp412.json',
      leadsStorage: { type: 'csv' }
    };
    const defaultServer = new AdminServer(defaultConfig, mockWhatsAppAdapter as WhatsAppAdapter);
    expect((defaultServer as any).port).toBe(3000);
    expect((defaultServer as any).password).toBe('admin123');
  });

  it('debería manejar la promesa rechazada de resetAccount en segundo plano', async () => {
    (mockWhatsAppAdapter.resetAccount as jest.Mock).mockRejectedValueOnce(new Error('Async reset error'));
    await adminServer.start();
    const res = await makeRequest('POST', '/api/reset', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });

  it('debería listar flujos en GET /api/flows', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/api/flows', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.flows).toBeDefined();
    expect(Array.isArray(data.flows)).toBe(true);
  });

  it('debería obtener un flujo por ID en GET /api/flows/:id', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/api/flows/flow_cfp412', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.id).toBe('flow_cfp412');
    expect(Array.isArray(data.nodes)).toBe(true);
  });

  it('debería retornar 404 si el flujo no existe en GET /api/flows/:id', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/api/flows/non_existent_flow', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(404);
  });

  it('debería retornar 500 si ocurre un error al listar flujos en GET /api/flows', async () => {
    (adminServer as any).flowManager = {
      getAvailableFlows: () => { throw new Error('Error simulado'); }
    };
    await adminServer.start();
    const res = await makeRequest('GET', '/api/flows', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(500);
  });

  it('debería guardar un flujo en POST /api/flows/:id', async () => {
    await adminServer.start();
    const testNodes = [{ id: 'TEST', text: 'Hola', options: [] }];
    const res = await makeRequest('POST', '/api/flows/flow_test_temp', {
      Cookie: 'admin_session=testpassword123'
    }, { nodes: testNodes });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
  });

  it('debería retornar error 400 si nodes no es un arreglo en POST /api/flows/:id', async () => {
    await adminServer.start();
    const res = await makeRequest('POST', '/api/flows/flow_invalid', {
      Cookie: 'admin_session=testpassword123'
    }, { nodes: 'invalid' });
    expect(res.statusCode).toBe(400);
  });

  it('debería retornar 500 si falla saveFlow en POST /api/flows/:id', async () => {
    (adminServer as any).flowManager = {
      saveFlow: jest.fn().mockRejectedValue(new Error('Error de guardado'))
    };
    await adminServer.start();
    const res = await makeRequest('POST', '/api/flows/flow_err', {
      Cookie: 'admin_session=testpassword123'
    }, { nodes: [] });
    expect(res.statusCode).toBe(500);
  });

  it('debería retornar 500 si ocurre un error en GET /api/config', async () => {
    (adminServer as any).flowManager = {
      getAvailableFlows: () => { throw new Error('Error simulado'); }
    };
    await adminServer.start();
    const res = await makeRequest('GET', '/api/config', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(500);
  });

  it('debería responder con la configuración en GET /api/config', async () => {
    await adminServer.start();
    const res = await makeRequest('GET', '/api/config', {
      Cookie: 'admin_session=testpassword123'
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.timeoutMinutes).toBeDefined();
    expect(Array.isArray(data.availableFlows)).toBe(true);
  });

  it('debería actualizar la configuración exitosamente en POST /api/config', async () => {
    await adminServer.start();
    const res = await makeRequest('POST', '/api/config', {
      Cookie: 'admin_session=testpassword123'
    }, {
      timeoutMinutes: 20,
      defaultFlowId: 'flow_cfp412'
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
  });

  it('debería rechazar tiempo de inactividad inválido en POST /api/config', async () => {
    await adminServer.start();
    const res = await makeRequest('POST', '/api/config', {
      Cookie: 'admin_session=testpassword123'
    }, {
      timeoutMinutes: 0
    });
    expect(res.statusCode).toBe(400);
  });

  it('debería ignorar errores en setDefaultFlowId si el flujo no existe aún al actualizar configuración', async () => {
    (adminServer as any).flowManager = {
      setDefaultFlowId: () => { throw new Error('Flujo no encontrado'); }
    };
    await adminServer.start();
    const res = await makeRequest('POST', '/api/config', {
      Cookie: 'admin_session=testpassword123'
    }, {
      timeoutMinutes: 15,
      defaultFlowId: 'unregistered_flow'
    });
    expect(res.statusCode).toBe(200);
  });

  it('debería retornar 500 si ocurre una excepción inesperada en POST /api/config', async () => {
    Object.defineProperty(adminServer as any, 'config', {
      get: () => { throw new Error('Error catastrófico de config'); }
    });
    await adminServer.start();
    const res = await makeRequest('POST', '/api/config', {
      Cookie: 'admin_session=testpassword123'
    }, {
      timeoutMinutes: 15
    });
    expect(res.statusCode).toBe(500);
  });

  it('debería permitir iniciar sesión con contraseña correcta en POST /login', async () => {
    await adminServer.start();
    const res = await makeRequest('POST', '/login', {
      'Content-Type': 'application/x-www-form-urlencoded'
    }, 'password=testpassword123');
    expect(res.statusCode).toBe(302);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('debería rechazar inicio de sesión con contraseña incorrecta en POST /login', async () => {
    await adminServer.start();
    const res = await makeRequest('POST', '/login', {
      'Content-Type': 'application/x-www-form-urlencoded'
    }, 'password=wrongpass');
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain('Contraseña incorrecta');
  });
});
