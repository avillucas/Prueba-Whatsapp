import { LeadContacto, LeadListaEspera } from "./Lead";

export interface LeadRepository {
  saveContacto(sessionId: string, lead: LeadContacto): Promise<void>;
  saveListaEspera(sessionId: string, lead: LeadListaEspera): Promise<void>;
}
