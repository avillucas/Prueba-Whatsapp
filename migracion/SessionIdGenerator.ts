import * as os from 'os';
import * as crypto from 'crypto';

export class SessionIdGenerator {
  /**
   * Genera un ID de sesión único basado en el tiempo actual y la dirección MAC de la máquina (contenedor/host).
   * Se añade también el identificador del usuario (remoteJid) para que la sesión sea trazable al usuario.
   */
  static generate(remoteJid: string): string {
    // 1. Obtener la dirección MAC
    let macAddress = "00:00:00:00:00:00";
    const networkInterfaces = os.networkInterfaces();
    
    for (const key in networkInterfaces) {
      const iface = networkInterfaces[key];
      if (iface) {
        for (const i of iface) {
          if (!i.internal && i.mac !== "00:00:00:00:00:00") {
            macAddress = i.mac;
            break;
          }
        }
      }
      if (macAddress !== "00:00:00:00:00:00") break;
    }

    // 2. Hashear la MAC para no exponerla directamente (privacidad) y mantenerla corta
    const macHash = crypto.createHash('md5').update(macAddress).digest('hex').substring(0, 6);
    
    // 3. Obtener el tiempo actual (timestamp)
    const timestamp = Date.now().toString(36); // Base 36 para hacerlo más corto y alfanumérico

    // 4. Limpiar el remoteJid (e.g. 5491112345678@s.whatsapp.net -> 5491112345678)
    const cleanJid = remoteJid.split('@')[0];

    // Formato final: [JID]_[MAC-HASH]_[TIMESTAMP]
    return `${cleanJid}_${macHash}_${timestamp}`;
  }
}
