import { RedisFlowRepository } from '../../infrastructure/repositories/RedisFlowRepository';
import { DecisionTreeManager } from '../../application/DecisionTreeManager';
import { DecisionNode } from 'motor-decision';

describe('RedisFlowRepository Test Suite', () => {
  let mockRedis: any;
  let repository: RedisFlowRepository;

  beforeEach(() => {
    mockRedis = {
      status: 'connect',
      connect: jest.fn().mockResolvedValue(undefined),
      hget: jest.fn(),
      hset: jest.fn().mockResolvedValue(1),
      hkeys: jest.fn().mockResolvedValue([]),
      hdel: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue(undefined)
    };

    repository = new RedisFlowRepository({
      keyPrefix: 'test_flows',
      redisInstance: mockRedis
    });
  });

  it('debería consultar y parsear un flujo exitosamente con getFlow', async () => {
    const nodes: DecisionNode[] = [
      { id: 'NODE1', text: 'Hola', options: [] }
    ];
    mockRedis.hget.mockResolvedValueOnce(JSON.stringify(nodes));

    const result = await repository.getFlow('flow_test');
    expect(mockRedis.hget).toHaveBeenCalledWith('test_flows', 'flow_test');
    expect(result).toEqual(nodes);
  });

  it('debería retornar null si el flujo no existe en Redis', async () => {
    mockRedis.hget.mockResolvedValueOnce(null);

    const result = await repository.getFlow('inexistent');
    expect(result).toBeNull();
  });

  it('debería guardar un flujo correctamente con saveFlow', async () => {
    const nodes: DecisionNode[] = [
      { id: 'NODE1', text: 'Bienvenido', options: [] }
    ];

    await repository.saveFlow('flow_new', nodes);
    expect(mockRedis.hset).toHaveBeenCalledWith(
      'test_flows',
      'flow_new',
      JSON.stringify(nodes, null, 2)
    );
  });

  it('debería listar las claves de los flujos con listFlows', async () => {
    mockRedis.hkeys.mockResolvedValueOnce(['flow_cfp412', 'flow_v2']);

    const flows = await repository.listFlows();
    expect(flows).toEqual(['flow_cfp412', 'flow_v2']);
  });

  it('debería eliminar un flujo de Redis con deleteFlow', async () => {
    await repository.deleteFlow('flow_to_delete');
    expect(mockRedis.hdel).toHaveBeenCalledWith('test_flows', 'flow_to_delete');
  });

  it('debería sincronizar flujos con Redis mediante DecisionTreeManager.loadFlows()', async () => {
    const manager = new DecisionTreeManager(undefined, repository);

    // Simular que Redis no tiene flujos inicialmente (requiere sembrado / seed)
    mockRedis.hkeys.mockResolvedValueOnce([]);
    
    await manager.loadFlows();

    // Debe sembrar los flujos locales (e.g. flow_cfp412) en Redis
    expect(mockRedis.hset).toHaveBeenCalled();
  });

  it('debería dar prioridad a la versión en Redis durante loadFlows si ya existe', async () => {
    const redisNodes: DecisionNode[] = [
      { id: 'MSG_INICIAL', text: 'Texto editado en Redis', options: [] }
    ];
    mockRedis.hkeys.mockResolvedValueOnce(['flow_cfp412']);
    mockRedis.hget.mockResolvedValueOnce(JSON.stringify(redisNodes));

    const manager = new DecisionTreeManager(undefined, repository);
    await manager.loadFlows();

    const provider = manager.getFlowProvider('flow_cfp412');
    expect(provider.getFlow()[0].text).toBe('Texto editado en Redis');
  });
});
