import express, { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import QRCode from 'qrcode';
import { WhatsAppAdapter } from '../adapters/WhatsAppAdapter';
import { AppConfig } from '../../config/config';
import { ErrorHandler } from '../logging/ErrorHandler';

export class AdminServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private whatsappAdapter: WhatsAppAdapter;
  private port: number;
  private password: string;

  constructor(config: AppConfig, whatsappAdapter: WhatsAppAdapter) {
    this.app = express();
    this.whatsappAdapter = whatsappAdapter;
    this.port = config.adminWeb?.port || 3000;
    this.password = config.adminWeb?.password || 'admin123';

    this.configureMiddleware();
    this.configureRoutes();
  }

  private parseCookies(req: Request): Record<string, string> {
    const list: Record<string, string> = {};
    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const name = parts.shift()?.trim();
      const value = decodeURIComponent(parts.join('='));
      if (name) {
        list[name] = value;
      }
    });

    return list;
  }

  private configureMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const cookies = this.parseCookies(req);
    const token = cookies['admin_session'];

    if (token === this.password) {
      next();
      return;
    }

    if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    res.redirect('/login');
  };

  private configureRoutes(): void {
    // Ruta de Login (GET)
    this.app.get('/login', (req: Request, res: Response) => {
      const cookies = this.parseCookies(req);
      if (cookies['admin_session'] === this.password) {
        res.redirect('/');
        return;
      }

      res.send(this.renderLoginPage());
    });

    // Ruta de Login (POST)
    this.app.post('/login', (req: Request, res: Response) => {
      const { password } = req.body;
      if (password === this.password) {
        res.setHeader('Set-Cookie', `admin_session=${encodeURIComponent(password)}; Path=/; HttpOnly; SameSite=Strict`);
        res.redirect('/');
      } else {
        res.send(this.renderLoginPage('Contraseña incorrecta. Por favor reintente.'));
      }
    });

    // Ruta de Logout
    this.app.get('/logout', (_req: Request, res: Response) => {
      res.setHeader('Set-Cookie', 'admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      res.redirect('/login');
    });

    // Ruta Dashboard Principal (Protegida)
    this.app.get('/', this.authMiddleware, (_req: Request, res: Response) => {
      res.send(this.renderDashboardPage());
    });

    // API de Estado en Tiempo Real
    this.app.get('/api/status', this.authMiddleware, async (_req: Request, res: Response) => {
      try {
        const status = this.whatsappAdapter.getStatus();
        const rawQr = this.whatsappAdapter.getQR();
        const connectedUser = this.whatsappAdapter.getConnectedUser();

        let qrDataUrl: string | null = null;
        if (status === 'WAITING_QR' && rawQr) {
          qrDataUrl = await QRCode.toDataURL(rawQr, { margin: 2, width: 300 });
        }

        res.json({
          status,
          qrDataUrl,
          connectedUser
        });
      } catch (error: any) {
        ErrorHandler.logSystem('AdminServer', `Error al consultar estado: ${error.message}`);
        res.status(500).json({ error: 'Error al obtener estado del bot' });
      }
    });

    // API para Resetear la Cuenta de WhatsApp
    this.app.post('/api/reset', this.authMiddleware, async (_req: Request, res: Response) => {
      try {
        ErrorHandler.logSystem('AdminServer', 'Solicitud recibida en la API para resetear la cuenta de WhatsApp.');
        // Ejecutar reseteo en segundo plano o asíncrono y responder inmediatamente
        this.whatsappAdapter.resetAccount().catch((err) => {
          ErrorHandler.handle('AdminServer', err);
        });

        res.json({
          success: true,
          message: 'Iniciando reseteo de la cuenta de WhatsApp. Se generará un nuevo código QR en breve.'
        });
      } catch (error: any) {
        ErrorHandler.handle('AdminServer', error);
        res.status(500).json({ error: 'Error al procesar el reseteo de la cuenta' });
      }
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        ErrorHandler.logSystem('AdminServer', `🌐 Panel Administrativo Web iniciado en el puerto ${this.port} (http://localhost:${this.port})`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          ErrorHandler.logSystem('AdminServer', 'Servidor web administrativo detenido.');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private renderLoginPage(errorMessage?: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso Administrativo - WhatsApp Bot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.1);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --error-bg: rgba(239, 68, 68, 0.2);
      --error-border: rgba(239, 68, 68, 0.4);
      --error-text: #fca5a5;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body {
      background: var(--bg-gradient);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-main);
      padding: 1.5rem;
    }
    .login-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 1.5rem;
      padding: 2.5rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .logo-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .logo-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
      border-radius: 1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      margin-bottom: 1rem;
      box-shadow: 0 10px 20px -5px rgba(37, 211, 102, 0.3);
    }
    h1 { font-size: 1.5rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem; }
    p.subtitle { font-size: 0.875rem; color: var(--text-muted); }
    .form-group { margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; font-weight: 500; color: var(--text-muted); margin-bottom: 0.5rem; }
    input[type="password"] {
      width: 100%;
      padding: 0.875rem 1rem;
      border-radius: 0.75rem;
      border: 1px solid var(--card-border);
      background: rgba(15, 23, 42, 0.6);
      color: var(--text-main);
      font-size: 1rem;
      outline: none;
      transition: all 0.2s;
    }
    input[type="password"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }
    .btn-submit {
      width: 100%;
      padding: 0.875rem;
      border-radius: 0.75rem;
      border: none;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.2s;
    }
    .btn-submit:hover {
      box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4);
      transform: translateY(-1px);
    }
    .error-box {
      background: var(--error-bg);
      border: 1px solid var(--error-border);
      color: var(--error-text);
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="logo-header">
      <div class="logo-icon">📱</div>
      <h1>Panel Administrativo</h1>
      <p class="subtitle">Gestión del Bot de WhatsApp</p>
    </div>

    ${errorMessage ? `<div class="error-box">${errorMessage}</div>` : ''}

    <form method="POST" action="/login">
      <div class="form-group">
        <label for="password">Contraseña Única de Acceso</label>
        <input type="password" id="password" name="password" placeholder="Ingrese su contraseña..." required autofocus />
      </div>
      <button type="submit" class="btn-submit">Ingresar al Panel</button>
    </form>
  </div>
</body>
</html>`;
  }

  private renderDashboardPage(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gestión y Reseteo - WhatsApp Bot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.1);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body {
      background: var(--bg-gradient);
      min-height: 100vh;
      color: var(--text-main);
      padding: 2rem 1rem;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      padding: 1.25rem 2rem;
      border-radius: 1.25rem;
    }
    .header-title {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .header-title h1 { font-size: 1.35rem; font-weight: 700; }
    .btn-logout {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid var(--card-border);
      transition: all 0.2s;
    }
    .btn-logout:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
    @media (min-width: 768px) {
      .grid { grid-template-columns: 1fr 1fr; }
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 1.25rem;
      padding: 1.75rem;
      box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.4);
    }
    .card-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;

    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .badge-connected { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
    .badge-waiting { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-disconnected { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }
    .user-info {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
      background: rgba(15, 23, 42, 0.4);
      padding: 0.875rem 1rem;
      border-radius: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .user-info span { font-weight: 600; color: var(--text-main); }
    .qr-container {
      text-align: center;
      padding: 1rem;
      background: #ffffff;
      border-radius: 1rem;
      margin-top: 1rem;
      display: inline-block;
      width: 100%;
      max-width: 280px;
    }
    .qr-container img {
      width: 100%;
      height: auto;
      display: block;
    }
    .steps-list {
      list-style: none;
      counter-reset: step-counter;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }
    .steps-list li {
      counter-increment: step-counter;
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .steps-list li::before {
      content: counter(step-counter);
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      font-weight: 700;
      font-size: 0.8rem;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .btn-reset {
      width: 100%;
      padding: 1rem;
      border-radius: 0.875rem;
      border: none;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
      margin-top: 1.5rem;
      box-shadow: 0 10px 20px -5px rgba(239, 68, 68, 0.3);
    }
    .btn-reset:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 25px -5px rgba(239, 68, 68, 0.4);
    }
    .btn-reset:active { transform: translateY(0); }
    
    /* Modal de Confirmación */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal-content {
      background: #1e293b;
      border: 1px solid var(--card-border);
      border-radius: 1.25rem;
      padding: 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .modal-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .modal-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem; }
    .modal-desc { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.5; }
    .modal-actions { display: flex; gap: 1rem; }
    .btn-cancel {
      flex: 1;
      padding: 0.75rem;
      border-radius: 0.75rem;
      border: 1px solid var(--card-border);
      background: transparent;
      color: var(--text-main);
      font-weight: 600;
      cursor: pointer;
    }
    .btn-confirm {
      flex: 1;
      padding: 0.75rem;
      border-radius: 0.75rem;
      border: none;
      background: #ef4444;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-title">
        <span style="font-size: 1.75rem;">⚡</span>
        <div>
          <h1>Gestión de WhatsApp Bot</h1>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Acceso Administrativo</p>
        </div>
      </div>
      <a href="/logout" class="btn-logout">Cerrar Sesión</a>
    </header>

    <div class="grid">
      <!-- Tarjeta 1: Estado de la Conexión y Código QR -->
      <div class="card">
        <div class="card-title">📡 Estado de la Conexión</div>
        
        <div id="statusBadge" class="status-badge badge-disconnected">
          <span class="pulse-dot"></span>
          <span id="statusText">Cargando estado...</span>
        </div>

        <div id="userInfoBox" class="user-info" style="display: none;">
          Dispositivo Vinculado: <br><span id="userJidText">-</span>
        </div>

        <div id="qrBox" style="text-align: center; display: none;">
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            Escanea este código QR desde tu teléfono para vincular una nueva cuenta:
          </p>
          <div class="qr-container">
            <img id="qrImage" src="" alt="Código QR de WhatsApp" />
          </div>
        </div>
      </div>

      <!-- Tarjeta 2: Pasos para Escanear y Acción de Reseteo -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div class="card-title">📱 Pasos para Vincular Dispositivo</div>
          <ol class="steps-list">
            <li>Abre la aplicación de <strong>WhatsApp</strong> en tu teléfono celular.</li>
            <li>Toca el menú de opciones (tres puntos <strong>⋮</strong> en Android o <strong>Configuración</strong> en iPhone).</li>
            <li>Selecciona la opción <strong>Dispositivos vinculados</strong>.</li>
            <li>Toca el botón <strong>Vincular un dispositivo</strong>.</li>
            <li>Apunta la cámara del teléfono hacia el código QR mostrado en esta pantalla.</li>
          </ol>
        </div>

        <div>
          <button id="btnReset" class="btn-reset">
            <span>🔄</span> Resetear Cuenta WhatsApp
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal de Confirmación -->
  <div id="confirmModal" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-icon">⚠️</div>
      <div class="modal-title">¿Resetear cuenta de WhatsApp?</div>
      <div class="modal-desc">
        Esta acción desvinculará la sesión del dispositivo actual, borrará las credenciales almacenadas y generará un <strong>nuevo código QR</strong> para que puedas asociar otro dispositivo.
      </div>
      <div class="modal-actions">
        <button id="btnCancelReset" class="btn-cancel">Cancelar</button>
        <button id="btnConfirmReset" class="btn-confirm">Sí, Resetear</button>
      </div>
    </div>
  </div>

  <script>
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const userInfoBox = document.getElementById('userInfoBox');
    const userJidText = document.getElementById('userJidText');
    const qrBox = document.getElementById('qrBox');
    const qrImage = document.getElementById('qrImage');
    const btnReset = document.getElementById('btnReset');
    const confirmModal = document.getElementById('confirmModal');
    const btnCancelReset = document.getElementById('btnCancelReset');
    const btnConfirmReset = document.getElementById('btnConfirmReset');

    async function fetchStatus() {
      try {
        const response = await fetch('/api/status');
        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }
          return;
        }

        const data = await response.json();
        updateUI(data);
      } catch (err) {
        console.error('Error fetching status:', err);
      }
    }

    function updateUI(data) {
      const { status, qrDataUrl, connectedUser } = data;

      statusBadge.className = 'status-badge ';

      if (status === 'CONNECTED') {
        statusBadge.classList.add('badge-connected');
        statusText.textContent = 'CONECTADO Y ACTIVO';
        userInfoBox.style.display = 'block';
        userJidText.textContent = connectedUser || 'Dispositivo WhatsApp Vinculado';
        qrBox.style.display = 'none';
      } else if (status === 'WAITING_QR') {
        statusBadge.classList.add('badge-waiting');
        statusText.textContent = 'ESPERANDO ESCANEO DE QR';
        userInfoBox.style.display = 'none';
        
        if (qrDataUrl) {
          qrImage.src = qrDataUrl;
          qrBox.style.display = 'block';
        } else {
          qrBox.style.display = 'none';
        }
      } else {
        statusBadge.classList.add('badge-disconnected');
        statusText.textContent = 'DESCONECTADO / REINICIANDO...';
        userInfoBox.style.display = 'none';
        qrBox.style.display = 'none';
      }
    }

    btnReset.addEventListener('click', () => {
      confirmModal.style.display = 'flex';
    });

    btnCancelReset.addEventListener('click', () => {
      confirmModal.style.display = 'none';
    });

    btnConfirmReset.addEventListener('click', async () => {
      confirmModal.style.display = 'none';
      btnReset.disabled = true;
      btnReset.style.opacity = '0.6';
      statusText.textContent = 'RESETEANDO CUENTA...';

      try {
        const response = await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        alert(result.message || 'Reseteo en proceso...');
      } catch (err) {
        alert('Error al solicitar el reseteo de la cuenta.');
      } finally {
        setTimeout(() => {
          btnReset.disabled = false;
          btnReset.style.opacity = '1';
          fetchStatus();
        }, 3000);
      }
    });

    // Polling cada 2.5 segundos para estado en tiempo real
    fetchStatus();
    setInterval(fetchStatus, 2500);
  </script>
</body>
</html>`;
  }
}
