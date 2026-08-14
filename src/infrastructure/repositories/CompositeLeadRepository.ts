import { LeadRepository } from '../../domain/LeadRepository';
import { LeadContacto, LeadListaEspera } from '../../domain/Lead';

export class CompositeLeadRepository implements LeadRepository {
  private repositories: LeadRepository[];

  constructor(repositories: LeadRepository[]) {
    this.repositories = repositories;
  }

  async saveContacto(sessionId: string, lead: LeadContacto): Promise<void> {
    const promises = this.repositories.map(repo => 
      repo.saveContacto(sessionId, lead).catch(err => {
        console.error(`[CompositeLeadRepository] Error en repositorio ${repo.constructor.name}:`, err);
      })
    );
    await Promise.all(promises);
  }

  async saveListaEspera(sessionId: string, lead: LeadListaEspera): Promise<void> {
    const promises = this.repositories.map(repo => 
      repo.saveListaEspera(sessionId, lead).catch(err => {
        console.error(`[CompositeLeadRepository] Error en repositorio ${repo.constructor.name}:`, err);
      })
    );
    await Promise.all(promises);
  }
}
