import express, { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import QRCode from 'qrcode';
import { WhatsAppAdapter } from '../adapters/WhatsAppAdapter';
import { AppConfig } from '../../config/config';
import { ErrorHandler } from '../logging/ErrorHandler';
import { DecisionTreeManager } from '../../application/DecisionTreeManager';

export class AdminServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private whatsappAdapter: WhatsAppAdapter;
  private flowManager: DecisionTreeManager;
  private config: AppConfig;
  private port: number;
  private password: string;

  constructor(config: AppConfig, whatsappAdapter: WhatsAppAdapter, flowManager?: DecisionTreeManager) {
    this.app = express();
    this.config = config;
    this.whatsappAdapter = whatsappAdapter;
    this.flowManager = flowManager || new DecisionTreeManager(path.resolve(process.cwd(), 'flows'));
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
        res.status(401).send(this.renderLoginPage('Contraseña incorrecta. Por favor reintente.'));
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

    // API: Listar flujos de decisión disponibles
    this.app.get('/api/flows', this.authMiddleware, (_req: Request, res: Response) => {
      try {
        const flowIds = this.flowManager.getAvailableFlows();
        const flows = flowIds.map((id) => ({
          id,
          fileName: `${id}.json`
        }));
        res.json({ flows });
      } catch (err: any) {
        ErrorHandler.logSystem('AdminServer', `Error al listar flujos: ${err.message}`);
        res.status(500).json({ error: 'Error al obtener la lista de flujos' });
      }
    });

    // API: Obtener contenido de un flujo de decisión
    this.app.get('/api/flows/:id', this.authMiddleware, (req: Request, res: Response) => {
      try {
        const flowId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
        try {
          const provider = this.flowManager.getFlowProvider(flowId);
          const nodes = provider.getFlow();
          res.json({ id: flowId, nodes });
        } catch (_err) {
          res.status(404).json({ error: 'Flujo de decisión no encontrado' });
        }
      } catch (err: any) {
        res.status(500).json({ error: `Error al leer el flujo: ${err.message}` });
      }
    });

    // API: Guardar o actualizar un flujo de decisión
    this.app.post('/api/flows/:id', this.authMiddleware, async (req: Request, res: Response) => {
      try {
        const flowId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
        const { nodes } = req.body;
        if (!Array.isArray(nodes)) {
          res.status(400).json({ error: 'El contenido del flujo debe ser un arreglo de nodos válido.' });
          return;
        }
        await this.flowManager.saveFlow(flowId, nodes);
        ErrorHandler.logSystem('AdminServer', `Árbol de decisión '${flowId}' guardado exitosamente desde la web.`);
        res.json({ success: true, message: `Árbol de decisión '${flowId}' guardado correctamente.` });
      } catch (err: any) {
        res.status(500).json({ error: `Error al guardar el árbol de decisión: ${err.message}` });
      }
    });

    // API: Obtener configuración de sesiones y ruteo de flujos
    this.app.get('/api/config', this.authMiddleware, (_req: Request, res: Response) => {
      try {
        const sessionConfig = this.config.sessionConfig || { timeoutMinutes: 15, defaultFlowId: 'flow_cfp412', phoneFlowMap: {} };
        const availableFlows = this.flowManager.getAvailableFlows();
        const defaultFlowId = sessionConfig.defaultFlowId || this.flowManager.getDefaultFlowId() || 'flow_cfp412';
        res.json({
          timeoutMinutes: sessionConfig.timeoutMinutes || 15,
          defaultFlowId,
          phoneFlowMap: sessionConfig.phoneFlowMap || {},
          availableFlows
        });
      } catch (err: any) {
        ErrorHandler.logSystem('AdminServer', `Error al consultar configuración: ${err.message}`);
        res.status(500).json({ error: 'Error al obtener la configuración' });
      }
    });

    // API: Guardar configuración de sesiones y ruteo de flujos
    this.app.post('/api/config', this.authMiddleware, (req: Request, res: Response) => {
      try {
        const { timeoutMinutes, defaultFlowId, phoneFlowMap } = req.body;

        const parsedTimeout = Number(timeoutMinutes);
        if (isNaN(parsedTimeout) || parsedTimeout <= 0) {
          res.status(400).json({ error: 'El tiempo de espera debe ser un número mayor a 0.' });
          return;
        }

        if (phoneFlowMap && typeof phoneFlowMap !== 'object') {
          res.status(400).json({ error: 'El mapeo de teléfonos debe ser un objeto válido.' });
          return;
        }

        const targetDefaultFlow = defaultFlowId ? String(defaultFlowId).trim() : (this.config.sessionConfig?.defaultFlowId || 'flow_cfp412');
        if (targetDefaultFlow && this.flowManager) {
          try {
            this.flowManager.setDefaultFlowId(targetDefaultFlow);
          } catch (_e) {
            // Ignorar si aún no existe en el registro
          }
        }

        this.config.sessionConfig = {
          timeoutMinutes: parsedTimeout,
          defaultFlowId: targetDefaultFlow,
          phoneFlowMap: phoneFlowMap || {}
        };

        if (this.whatsappAdapter && typeof this.whatsappAdapter.updateSessionConfig === 'function') {
          this.whatsappAdapter.updateSessionConfig(this.config.sessionConfig);
        }

        const configPath = path.resolve(process.cwd(), 'src/config/config.json');
        if (fs.existsSync(configPath)) {
          try {
            const rawContent = fs.readFileSync(configPath, 'utf-8');
            const jsonConfig = JSON.parse(rawContent);
            jsonConfig.sessionConfig = this.config.sessionConfig;
            fs.writeFileSync(configPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');
          } catch (e: any) {
            ErrorHandler.logSystem('AdminServer', `Aviso al guardar config.json: ${e.message}`);
          }
        }

        ErrorHandler.logSystem('AdminServer', 'Configuración de sesión y ruteo de flujos actualizada desde la web.');
        res.json({ success: true, message: 'Configuración actualizada correctamente.' });
      } catch (err: any) {
        res.status(500).json({ error: `Error al guardar la configuración: ${err.message}` });
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
  <title>Gestor Visual de Árboles de Decisión - WhatsApp Bot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      --card-bg: rgba(30, 41, 59, 0.75);
      --card-border: rgba(255, 255, 255, 0.12);
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
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
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
    .nav-tabs {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .tab-btn {
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      border: 1px solid var(--card-border);
      background: rgba(30, 41, 59, 0.4);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn.active {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
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
      margin-bottom: 1.5rem;
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
    .btn-action {
      padding: 0.7rem 1.2rem;
      border-radius: 0.75rem;
      border: none;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-success { background: var(--success); color: #fff; }
    .btn-danger { background: var(--danger); color: #fff; }
    .btn-secondary { background: rgba(255, 255, 255, 0.1); color: var(--text-main); border: 1px solid var(--card-border); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.18); }

    /* Flow Toolbar & Mode Switcher */
    .flow-toolbar {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      background: rgba(15, 23, 42, 0.5);
      padding: 1rem;
      border-radius: 1rem;
      border: 1px solid var(--card-border);
    }
    .toolbar-left, .toolbar-right {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .select-flow {
      padding: 0.65rem 1rem;
      border-radius: 0.75rem;
      border: 1px solid var(--card-border);
      background: rgba(15, 23, 42, 0.8);
      color: var(--text-main);
      font-size: 0.95rem;
      min-width: 220px;
      outline: none;
    }

    /* Node Form Cards */
    .node-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--card-border);
      border-radius: 1rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      transition: border-color 0.2s;
    }
    .node-card:hover {
      border-color: rgba(99, 102, 241, 0.4);
    }
    .node-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .node-id-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .node-badge {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
      padding: 0.25rem 0.6rem;
      border-radius: 0.5rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .input-field {
      width: 100%;
      padding: 0.65rem 0.85rem;
      border-radius: 0.6rem;
      border: 1px solid var(--card-border);
      background: rgba(15, 23, 42, 0.8);
      color: var(--text-main);
      font-size: 0.9rem;
      outline: none;
      transition: all 0.2s;
    }
    .input-field:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }
    .field-label {
      display: block;
      font-size: 0.825rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .form-group {
      margin-bottom: 1.1rem;
    }

    /* Transition Options List */
    .options-box {
      background: rgba(30, 41, 59, 0.4);
      border: 1px dashed var(--card-border);
      border-radius: 0.85rem;
      padding: 1rem;
      margin-top: 1rem;
    }
    .option-row {
      display: grid;
      grid-template-columns: 1fr 1fr 40px;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 0.75rem;
      background: rgba(15, 23, 42, 0.5);
      padding: 0.75rem;
      border-radius: 0.6rem;
    }
    .json-editor {
      width: 100%;
      height: 480px;
      background: #090d16;
      color: #38bdf8;
      font-family: 'Fira Code', monospace;
      font-size: 0.9rem;
      padding: 1.25rem;
      border-radius: 1rem;
      border: 1px solid var(--card-border);
      resize: vertical;
      outline: none;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-title">
        <span style="font-size: 1.75rem;">⚡</span>
        <div>
          <h1>Gestión de WhatsApp Bot & Árboles de Decisión</h1>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Panel Administrativo</p>
        </div>
      </div>
      <a href="/logout" class="btn-logout">Cerrar Sesión</a>
    </header>

    <!-- Pestañas de Navegación -->
    <div class="nav-tabs">
      <button class="tab-btn active" onclick="switchTab('tabStatus')">📡 Estado WhatsApp</button>
      <button class="tab-btn" onclick="switchTab('tabTrees')">🌳 Gestor Visual de Árboles</button>
      <button class="tab-btn" onclick="switchTab('tabConfig')">⚙️ Configuración de Sesiones</button>
    </div>

    <!-- Pestaña 1: Estado y Conexión -->
    <div id="tabStatus" class="tab-content active">
      <div class="grid">
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

        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="card-title">📱 Pasos para Vincular Dispositivo</div>
            <ol style="list-style: decimal; padding-left: 1.2rem; color: var(--text-muted); line-height: 1.6; font-size: 0.9rem;">
              <li>Abre <strong>WhatsApp</strong> en tu teléfono celular.</li>
              <li>Ingresa al menú de opciones (tres puntos <strong>⋮</strong> o <strong>Configuración</strong>).</li>
              <li>Selecciona <strong>Dispositivos vinculados</strong> y presiona <strong>Vincular un dispositivo</strong>.</li>
              <li>Escanea el código QR que figura en pantalla.</li>
            </ol>
          </div>
          <div>
            <button id="btnReset" class="btn-action btn-danger" style="width: 100%; margin-top: 1.5rem;">
              🔄 Resetear Cuenta WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pestaña 2: Gestor Visual de Árboles de Decisión -->
    <div id="tabTrees" class="tab-content">
      <div class="card">
        <div class="card-title">🌳 Editor Interactivo de Árboles de Decisión</div>
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Define fácilmente cada respuesta, la extracción de datos ('extractData') y los saltos o transiciones ('match') hacia otros nodos.
        </p>

        <!-- Barra de Herramientas -->
        <div class="flow-toolbar">
          <div class="toolbar-left">
            <label style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Árbol Activo:</label>
            <select id="selectFlows" class="select-flow" onchange="loadSelectedFlow()">
              <option value="">Cargando flujos...</option>
            </select>
            <button class="btn-action btn-primary" style="background: #0284c7;" onclick="createNewFlowPrompt()">➕ Nuevo Árbol</button>
          </div>
          
          <div class="toolbar-right">
            <button id="btnViewForm" class="btn-action btn-primary" onclick="toggleEditorView('form')">👁️ Formulario Visual</button>
            <button id="btnViewJson" class="btn-action btn-secondary" onclick="toggleEditorView('json')">💻 Código JSON</button>
            <button class="btn-action btn-success" onclick="saveCurrentFlow()">💾 Guardar Árbol</button>
          </div>
        </div>

        <!-- Vista 1: Formulario Visual por Nodos -->
        <div id="editorFormView">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1rem; color: var(--text-main);">Preguntas y Respuestas del Árbol (<span id="nodeCountText">0</span>)</h3>
            <button class="btn-action btn-primary" onclick="addNewNode()">➕ Añadir Pregunta / Respuestas</button>
          </div>
          
          <div id="nodesCardsContainer"></div>

          <div style="text-align: center; margin-top: 1.5rem;">
            <button class="btn-action btn-primary" onclick="addNewNode()">➕ Añadir Nueva Pregunta / Respuestas</button>
          </div>
        </div>

        <!-- Vista 2: Editor JSON Directo -->
        <div id="editorJsonView" style="display: none;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-size: 0.85rem; color: var(--text-muted);">Edición directa del arreglo de nodos JSON:</span>
            <button class="btn-action btn-secondary" onclick="formatJson()">✨ Formatear JSON</button>
          </div>
          <textarea id="jsonEditor" class="json-editor" spellcheck="false" placeholder="Cargando nodos del árbol de decisión..."></textarea>
        </div>
      </div>
    </div>

    <!-- Pestaña 3: Configuración de Sesiones y Ruteo por Teléfono -->
    <div id="tabConfig" class="tab-content">
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-title">⏳ Tiempo de Espera por Inactividad</div>
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Especifica los minutos de inactividad tras los cuales una conversación de WhatsApp se dará por cerrada automáticamente.
        </p>

        <div style="max-width: 350px;">
          <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">
            Tiempo de Espera (en Minutos)
          </label>
          <input type="number" id="cfgTimeoutInput" class="input-field" min="1" max="1440" value="15" style="width: 100%; padding: 0.6rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.375rem; color: #f8fafc;" />
        </div>
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-title">🌳 Árbol de Decisión Por Defecto (Charlas General)</div>
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Selecciona el flujo de conversación que se utilizará de forma predeterminada en las charlas cuando no haya un mapeo por teléfono.
        </p>

        <div style="max-width: 350px;">
          <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">
            Árbol de Decisión Inicial
          </label>
          <select id="cfgDefaultFlowSelect" class="select-flow" style="width: 100%; padding: 0.6rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.375rem; color: #f8fafc;">
          </select>
        </div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <div class="card-title" style="margin-bottom: 0.25rem;">📱 Ruteo de Árboles de Decisión por Número</div>
            <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0;">
              Asigna qué árbol de decisión se enviará automáticamente según el número de teléfono emisor (o prefijo).
            </p>
          </div>
          <button class="btn-action btn-primary" onclick="addPhoneMappingRow()">➕ Añadir Regla</button>
        </div>

        <div id="phoneMappingsContainer" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;"></div>

        <div style="text-align: right; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #334155;">
          <button class="btn-action btn-success" style="background: #16a34a; font-size: 1rem; padding: 0.65rem 1.5rem;" onclick="saveSessionConfig()">
            💾 Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    var currentFlowId = 'flow_cfp412';
    var currentNodes = [];
    var currentEditorMode = 'form'; // 'form' | 'json'
    var availableFlowsCache = [];

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });

      if (tabId === 'tabStatus') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('tabStatus').classList.add('active');
      } else if (tabId === 'tabTrees') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('tabTrees').classList.add('active');
        loadFlowList();
      } else if (tabId === 'tabConfig') {
        document.querySelectorAll('.tab-btn')[2].classList.add('active');
        document.getElementById('tabConfig').classList.add('active');
        loadConfigSettings();
      }
    }

    function toggleEditorView(mode) {
      currentEditorMode = mode;
      var formView = document.getElementById('editorFormView');
      var jsonView = document.getElementById('editorJsonView');
      var btnForm = document.getElementById('btnViewForm');
      var btnJson = document.getElementById('btnViewJson');

      if (mode === 'json') {
        syncFormToJson();
        formView.style.display = 'none';
        jsonView.style.display = 'block';
        btnForm.classList.remove('btn-primary'); btnForm.classList.add('btn-secondary');
        btnJson.classList.add('btn-primary'); btnJson.classList.remove('btn-secondary');
      } else {
        syncJsonToForm();
        jsonView.style.display = 'none';
        formView.style.display = 'block';
        btnJson.classList.remove('btn-primary'); btnJson.classList.add('btn-secondary');
        btnForm.classList.add('btn-primary'); btnForm.classList.remove('btn-secondary');
      }
    }

    // --- Estado WhatsApp ---
    async function fetchStatus() {
      try {
        var res = await fetch('/api/status');
        if (!res.ok) return;
        var data = await res.json();
        var status = data.status;
        var qrDataUrl = data.qrDataUrl;
        var connectedUser = data.connectedUser;

        var badge = document.getElementById('statusBadge');
        var text = document.getElementById('statusText');
        badge.className = 'status-badge ';

        if (status === 'CONNECTED') {
          badge.classList.add('badge-connected');
          text.textContent = 'CONECTADO Y ACTIVO';
          document.getElementById('userInfoBox').style.display = 'block';
          document.getElementById('userJidText').textContent = connectedUser || 'Dispositivo Vinculado';
          document.getElementById('qrBox').style.display = 'none';
        } else if (status === 'WAITING_QR') {
          badge.classList.add('badge-waiting');
          text.textContent = 'ESPERANDO ESCANEO DE QR';
          document.getElementById('userInfoBox').style.display = 'none';
          if (qrDataUrl) {
            document.getElementById('qrImage').src = qrDataUrl;
            document.getElementById('qrBox').style.display = 'block';
          }
        } else {
          badge.classList.add('badge-disconnected');
          text.textContent = 'DESCONECTADO';
          document.getElementById('userInfoBox').style.display = 'none';
          document.getElementById('qrBox').style.display = 'none';
        }
      } catch (_e) {}
    }

    document.getElementById('btnReset').addEventListener('click', async function() {
      if (confirm('¿Estás seguro de que deseas resetear la cuenta de WhatsApp?')) {
        await fetch('/api/reset', { method: 'POST' });
        alert('Reseteo solicitado. Se actualizará el estado en breve.');
        fetchStatus();
      }
    });

    setInterval(fetchStatus, 3000);
    fetchStatus();

    // --- Gestor Visual de Árboles ---
    async function loadFlowList() {
      try {
        var res = await fetch('/api/flows');
        var data = await res.json();
        var select = document.getElementById('selectFlows');
        select.innerHTML = '';
        data.flows.forEach(function(f) {
          var opt = document.createElement('option');
          opt.value = f.id;
          opt.textContent = f.fileName;
          if (f.id === currentFlowId) opt.selected = true;
          select.appendChild(opt);
        });
        if (data.flows.length > 0) {
          loadSelectedFlow();
        }
      } catch (err) {
        alert('Error al cargar la lista de árboles: ' + err.message);
      }
    }

    async function loadSelectedFlow() {
      var select = document.getElementById('selectFlows');
      currentFlowId = select.value;
      if (!currentFlowId) return;

      try {
        var res = await fetch('/api/flows/' + currentFlowId);
        var data = await res.json();
        currentNodes = data.nodes || [];
        document.getElementById('jsonEditor').value = JSON.stringify(currentNodes, null, 2);
        renderNodesForm();
      } catch (err) {
        alert('Error al obtener el árbol: ' + err.message);
      }
    }

    function renderNodesForm() {
      var container = document.getElementById('nodesCardsContainer');
      document.getElementById('nodeCountText').textContent = currentNodes.length;
      container.innerHTML = '';

      var nodeIds = currentNodes.map(function(n) { return n.id; });

      currentNodes.forEach(function(node, nodeIdx) {
        var card = document.createElement('div');
        card.className = 'node-card';

        var presetFields = ['Opcion_Elegida', 'Nombre_y_Apellido', 'Telefono_WhatsApp', 'Email', 'Accion_Reinicio'];
        var currentExtract = node.extractData || '';
        var isCustomExtract = currentExtract && !presetFields.includes(currentExtract);

        var html = '';
        html += '<div class="node-header">';
        html += '  <div class="node-id-box">';
        html += '    <span class="node-badge">NODO #' + (nodeIdx + 1) + '</span>';
        html += '    <input type="text" class="input-field" style="width: 220px; font-weight: 700;" value="' + escapeHtml(node.id) + '" onchange="updateNodeId(' + nodeIdx + ', this.value)" placeholder="ID de Nodo (ej: MSG_INICIAL)">';
        html += '  </div>';
        html += '  <button class="btn-action btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="deleteNode(' + nodeIdx + ')">🗑️ Eliminar</button>';
        html += '</div>';

        html += '<div class="form-group">';
        html += '  <label class="field-label">💬 Mensaje / Pregunta al Usuario (Soporta {{Variable}})</label>';
        html += '  <textarea class="input-field" style="height: 90px; resize: vertical;" onchange="updateNodeText(' + nodeIdx + ', this.value)" placeholder="Texto que enviará el Bot al usuario...">' + escapeHtml(node.text || '') + '</textarea>';
        html += '</div>';

        html += '<div class="form-group">';
        html += '  <label class="field-label">📥 Recolección de Datos de Lead (extractData)</label>';
        html += '  <div style="display: flex; gap: 0.75rem; align-items: center;">';
        html += '    <select class="input-field" style="width: 50%;" onchange="updateNodeExtractDataSelect(' + nodeIdx + ', this.value)">';
        html += '      <option value="" ' + (!currentExtract ? 'selected' : '') + '>-- Sin Extracción (Respuesta libre / Navegación) --</option>';
        html += '      <option value="Opcion_Elegida" ' + (currentExtract === 'Opcion_Elegida' ? 'selected' : '') + '>Opción Elegida del Menú (Opcion_Elegida)</option>';
        html += '      <option value="Nombre_y_Apellido" ' + (currentExtract === 'Nombre_y_Apellido' ? 'selected' : '') + '>Nombre y Apellido del Lead (Nombre_y_Apellido)</option>';
        html += '      <option value="Telefono_WhatsApp" ' + (currentExtract === 'Telefono_WhatsApp' ? 'selected' : '') + '>Teléfono de Contacto (Telefono_WhatsApp)</option>';
        html += '      <option value="Email" ' + (currentExtract === 'Email' ? 'selected' : '') + '>Correo Electrónico (Email)</option>';
        html += '      <option value="Accion_Reinicio" ' + (currentExtract === 'Accion_Reinicio' ? 'selected' : '') + '>Acción de Reinicio/Menú (Accion_Reinicio)</option>';
        html += '      <option value="__CUSTOM__" ' + (isCustomExtract ? 'selected' : '') + '>✨ Personalizado / Campo Personalizado...</option>';
        html += '    </select>';
        html += '    <input type="text" id="customExtract_' + nodeIdx + '" class="input-field" style="width: 50%; display: ' + (isCustomExtract ? 'block' : 'none') + ';" value="' + escapeHtml(currentExtract) + '" onchange="updateNodeTextExtractCustom(' + nodeIdx + ', this.value)" placeholder="Escribe el nombre de la variable...">';
        html += '  </div>';
        html += '</div>';

        html += '<div class="options-box">';
        html += '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">';
        html += '    <span class="field-label" style="margin: 0;">🔀 Coincidencias (Match) y Transiciones de Respuesta</span>';
        html += '    <button class="btn-action btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="addOptionToNode(' + nodeIdx + ')">➕ Añadir Transición</button>';
        html += '  </div>';

        html += '  <div id="optionsContainer_' + nodeIdx + '">';
        (node.options || []).forEach(function(opt, optIdx) {
          html += '    <div class="option-row">';
          html += '      <div>';
          html += '        <label class="field-label" style="font-size: 0.75rem;">Coincidencia (Match)</label>';
          html += '        <input type="text" class="input-field" value="' + escapeHtml(opt.match) + '" onchange="updateOptionMatch(' + nodeIdx + ', ' + optIdx + ', this.value)" placeholder="ej: A, 1, *">';
          html += '      </div>';
          html += '      <div>';
          html += '        <label class="field-label" style="font-size: 0.75rem;">Ir al Nodo (nextId)</label>';
          html += '        <select class="input-field" onchange="updateOptionNextId(' + nodeIdx + ', ' + optIdx + ', this.value)">';
          nodeIds.forEach(function(id) {
            html += '          <option value="' + id + '" ' + (opt.nextId === id ? 'selected' : '') + '>' + id + '</option>';
          });
          html += '          <option value="__CUSTOM_NEXT__" ' + (!nodeIds.includes(opt.nextId) ? 'selected' : '') + '>-- Escribir ID manual --</option>';
          html += '        </select>';
          html += '      </div>';
          html += '      <div style="text-align: right; margin-top: 1rem;">';
          html += '        <button class="btn-action btn-danger" style="padding: 0.45rem 0.65rem;" onclick="deleteOption(' + nodeIdx + ', ' + optIdx + ')">🗑️</button>';
          html += '      </div>';
          html += '    </div>';
        });
        html += '  </div>';
        html += '</div>';

        card.innerHTML = html;
        container.appendChild(card);
      });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function updateNodeId(nodeIdx, val) {
      currentNodes[nodeIdx].id = val.trim();
      syncFormToJson();
      renderNodesForm();
    }

    function updateNodeText(nodeIdx, val) {
      currentNodes[nodeIdx].text = val;
      syncFormToJson();
    }

    function updateNodeExtractDataSelect(nodeIdx, val) {
      var customInput = document.getElementById('customExtract_' + nodeIdx);
      if (val === '__CUSTOM__') {
        customInput.style.display = 'block';
        currentNodes[nodeIdx].extractData = customInput.value.trim();
      } else {
        customInput.style.display = 'none';
        if (val) {
          currentNodes[nodeIdx].extractData = val;
        } else {
          delete currentNodes[nodeIdx].extractData;
        }
      }
      syncFormToJson();
    }

    function updateNodeTextExtractCustom(nodeIdx, val) {
      if (val.trim()) {
        currentNodes[nodeIdx].extractData = val.trim();
      } else {
        delete currentNodes[nodeIdx].extractData;
      }
      syncFormToJson();
    }

    function updateOptionMatch(nodeIdx, optIdx, val) {
      if (!currentNodes[nodeIdx].options) currentNodes[nodeIdx].options = [];
      currentNodes[nodeIdx].options[optIdx].match = val;
      syncFormToJson();
    }

    function updateOptionNextId(nodeIdx, optIdx, val) {
      if (!currentNodes[nodeIdx].options) currentNodes[nodeIdx].options = [];
      if (val === '__CUSTOM_NEXT__') {
        var nextManual = prompt('Ingresa el ID del nodo de destino:');
        if (nextManual) {
          currentNodes[nodeIdx].options[optIdx].nextId = nextManual.trim();
        }
      } else {
        currentNodes[nodeIdx].options[optIdx].nextId = val;
      }
      syncFormToJson();
      renderNodesForm();
    }

    function addOptionToNode(nodeIdx) {
      if (!currentNodes[nodeIdx].options) currentNodes[nodeIdx].options = [];
      var firstId = currentNodes[0] ? currentNodes[0].id : 'MSG_INICIAL';
      currentNodes[nodeIdx].options.push({ match: '1', nextId: firstId });
      syncFormToJson();
      renderNodesForm();
    }

    function deleteOption(nodeIdx, optIdx) {
      if (currentNodes[nodeIdx].options) {
        currentNodes[nodeIdx].options.splice(optIdx, 1);
        syncFormToJson();
        renderNodesForm();
      }
    }

    function addNewNode() {
      var newId = 'PREGUNTA_' + (currentNodes.length + 1);
      currentNodes.push({
        id: newId,
        text: 'Escribe el mensaje o pregunta aquí...',
        extractData: '',
        options: [{ match: '*', nextId: 'MSG_CIERRE' }]
      });
      syncFormToJson();
      renderNodesForm();
    }

    function deleteNode(nodeIdx) {
      if (confirm('¿Deseas eliminar esta pregunta / nodo del árbol?')) {
        currentNodes.splice(nodeIdx, 1);
        syncFormToJson();
        renderNodesForm();
      }
    }

    function syncFormToJson() {
      document.getElementById('jsonEditor').value = JSON.stringify(currentNodes, null, 2);
    }

    function syncJsonToForm() {
      try {
        var parsed = JSON.parse(document.getElementById('jsonEditor').value);
        if (Array.isArray(parsed)) {
          currentNodes = parsed;
          renderNodesForm();
        }
      } catch (_e) {}
    }

    function formatJson() {
      var editor = document.getElementById('jsonEditor');
      try {
        var parsed = JSON.parse(editor.value);
        editor.value = JSON.stringify(parsed, null, 2);
        currentNodes = parsed;
        renderNodesForm();
      } catch (err) {
        alert('Formato JSON no válido: ' + err.message);
      }
    }

    async function saveCurrentFlow() {
      if (currentEditorMode === 'json') {
        syncJsonToForm();
      } else {
        syncFormToJson();
      }

      try {
        var res = await fetch('/api/flows/' + currentFlowId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes: currentNodes })
        });
        var result = await res.json();
        if (res.ok) {
          alert('✅ ' + result.message);
        } else {
          alert('❌ ' + result.error);
        }
      } catch (err) {
        alert('Error al guardar el árbol de decisión: ' + err.message);
      }
    }

    async function createNewFlowPrompt() {
      var name = prompt('Ingresa el nombre del nuevo árbol de decisión (ej: flow_ventas):');
      if (!name) return;
      var cleanName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (!cleanName) return;

      var template = [
        {
          "id": "MSG_INICIAL",
          "text": "👋 ¡Hola! Bienvenido.\\n• A. Opción 1\\n• B. Opción 2",
          "extractData": "Opcion_Elegida",
          "options": [
            { "match": "A", "nextId": "RESP_A" },
            { "match": "B", "nextId": "RESP_B" }
          ]
        },
        {
          "id": "RESP_A",
          "text": "Por favor indícanos tu Nombre y Apellido:",
          "extractData": "Nombre_y_Apellido",
          "options": [{ "match": "*", "nextId": "MSG_CIERRE" }]
        },
        {
          "id": "RESP_B",
          "text": "Por favor indícanos tu Correo Electrónico:",
          "extractData": "Email",
          "options": [{ "match": "*", "nextId": "MSG_CIERRE" }]
        },
        {
          "id": "MSG_CIERRE",
          "text": "📌 Gracias por tus datos.",
          "options": []
        }
      ];

      currentFlowId = cleanName;
      currentNodes = template;
      syncFormToJson();
      renderNodesForm();
      await saveCurrentFlow();
      loadFlowList();
    }

    // --- Configuración de Sesiones y Ruteo ---
    async function loadConfigSettings() {
      try {
        var res = await fetch('/api/config');
        if (!res.ok) return;
        var data = await res.json();

        document.getElementById('cfgTimeoutInput').value = data.timeoutMinutes || 15;
        availableFlowsCache = data.availableFlows || [];

        var defaultSelect = document.getElementById('cfgDefaultFlowSelect');
        if (defaultSelect) {
          defaultSelect.innerHTML = availableFlowsCache.map(function(f) {
            var sel = f === (data.defaultFlowId || 'flow_cfp412') ? 'selected' : '';
            return '<option value="' + f + '" ' + sel + '>' + f + '</option>';
          }).join('');
        }

        var container = document.getElementById('phoneMappingsContainer');
        container.innerHTML = '';

        var phoneMap = data.phoneFlowMap || {};
        var keys = Object.keys(phoneMap);

        if (keys.length === 0) {
          container.innerHTML = '<div style="font-size: 0.875rem; color: var(--text-muted); font-style: italic;">No hay reglas por número configuradas (se usará el flujo por defecto).</div>';
        } else {
          keys.forEach(function(phone) {
            addPhoneMappingRow(phone, phoneMap[phone]);
          });
        }
      } catch (err) {
        console.error('Error al cargar configuración:', err);
      }
    }

    function addPhoneMappingRow(phone, flowId) {
      var container = document.getElementById('phoneMappingsContainer');
      if (container.children.length === 1 && container.children[0].tagName === 'DIV' && container.children[0].innerText.includes('No hay reglas')) {
        container.innerHTML = '';
      }

      var row = document.createElement('div');
      row.className = 'phone-mapping-row';
      row.style.cssText = 'display: flex; gap: 0.75rem; align-items: center; background: #0f172a; padding: 0.75rem; border: 1px solid #334155; border-radius: 0.375rem;';

      var phoneVal = phone || '';
      var flowVal = flowId || (availableFlowsCache[0] || 'flow_cfp412');

      var selectOptionsHtml = availableFlowsCache.map(function(f) {
        var sel = f === flowVal ? 'selected' : '';
        return '<option value="' + f + '" ' + sel + '>' + f + '</option>';
      }).join('');

      row.innerHTML = 
        '<div style="flex: 1;">' +
          '<input type="text" class="phone-input input-field" placeholder="Ej: 5491122334455 o default" value="' + phoneVal + '" style="width: 100%; padding: 0.5rem; background: #1e293b; border: 1px solid #475569; border-radius: 0.25rem; color: #f8fafc;" />' +
        '</div>' +
        '<div style="flex: 1;">' +
          '<select class="flow-select select-flow" style="width: 100%; padding: 0.5rem; background: #1e293b; border: 1px solid #475569; border-radius: 0.25rem; color: #f8fafc;">' +
            selectOptionsHtml +
          '</select>' +
        '</div>' +
        '<button class="btn-action btn-danger" style="padding: 0.5rem 0.75rem;" onclick="this.parentElement.remove()">🗑️</button>';

      container.appendChild(row);
    }

    async function saveSessionConfig() {
      var timeoutMinutes = Number(document.getElementById('cfgTimeoutInput').value);
      if (isNaN(timeoutMinutes) || timeoutMinutes <= 0) {
        alert('❌ El tiempo de espera debe ser un número entero mayor a 0.');
        return;
      }

      var defaultFlowId = document.getElementById('cfgDefaultFlowSelect').value;

      var phoneFlowMap = {};
      var rows = document.querySelectorAll('.phone-mapping-row');
      rows.forEach(function(row) {
        var phone = row.querySelector('.phone-input').value.trim();
        var flow = row.querySelector('.flow-select').value;
        if (phone) {
          phoneFlowMap[phone] = flow;
        }
      });

      try {
        var res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeoutMinutes: timeoutMinutes,
            defaultFlowId: defaultFlowId,
            phoneFlowMap: phoneFlowMap
          })
        });
        var result = await res.json();
        if (res.ok) {
          alert('✅ ' + result.message);
        } else {
          alert('❌ ' + result.error);
        }
      } catch (err) {
        alert('Error al guardar configuración: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
  }
}
