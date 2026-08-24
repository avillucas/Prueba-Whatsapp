import Redis from 'ioredis';
import { DecisionNode } from 'motor-decision';
import { FlowRepository } from '../../domain/FlowRepository';
import { ErrorHandler } from '../logging/ErrorHandler';

export interface RedisFlowRepositoryOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  redisInstance?: Redis;
}

export class RedisFlowRepository implements FlowRepository {
  private redis: Redis;
  private keyPrefix: string;
  private isExternalInstance: boolean;

  constructor(options: RedisFlowRepositoryOptions = {}) {
    this.keyPrefix = options.keyPrefix || process.env.REDIS_FLOW_KEY_PREFIX || 'whatsapp_flows';

    if (options.redisInstance) {
      this.redis = options.redisInstance;
      this.isExternalInstance = true;
    } else {
      const host = options.host || process.env.REDIS_HOST || 'localhost';
      const port = options.port || Number(process.env.REDIS_PORT) || 6379;
      const password = options.password || process.env.REDIS_PASSWORD || undefined;
      const db = options.db !== undefined ? options.db : Number(process.env.REDIS_DB || 0);

      this.isExternalInstance = false;
      this.redis = new Redis({
        host,
        port,
        password,
        db,
        lazyConnect: true,
        maxRetriesPerRequest: 3
      });

      this.redis.on('error', (err) => {
        ErrorHandler.logSystem('RedisFlowRepository', `Error de conexión en Redis: ${err.message}`);
      });
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'wait' || this.redis.status === 'close') {
      await this.redis.connect();
    }
  }

  async getFlow(flowId: string): Promise<DecisionNode[] | null> {
    try {
      await this.ensureConnected();
      const rawData = await this.redis.hget(this.keyPrefix, flowId);
      if (!rawData) {
        return null;
      }
      const parsed = JSON.parse(rawData);
      return Array.isArray(parsed) ? parsed : null;
    } catch (error: any) {
      ErrorHandler.logSystem('RedisFlowRepository', `Error al consultar flujo '${flowId}' en Redis: ${error.message}`);
      return null;
    }
  }

  async saveFlow(flowId: string, nodes: DecisionNode[]): Promise<void> {
    try {
      await this.ensureConnected();
      const jsonContent = JSON.stringify(nodes, null, 2);
      await this.redis.hset(this.keyPrefix, flowId, jsonContent);
      ErrorHandler.logSystem('RedisFlowRepository', `Flujo '${flowId}' guardado exitosamente en Redis (Hash: '${this.keyPrefix}').`);
    } catch (error: any) {
      ErrorHandler.handle('RedisFlowRepository', error, { flowId, keyPrefix: this.keyPrefix });
      throw error;
    }
  }

  async listFlows(): Promise<string[]> {
    try {
      await this.ensureConnected();
      const keys = await this.redis.hkeys(this.keyPrefix);
      return keys;
    } catch (error: any) {
      ErrorHandler.logSystem('RedisFlowRepository', `Error al listar flujos en Redis: ${error.message}`);
      return [];
    }
  }

  async deleteFlow(flowId: string): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.hdel(this.keyPrefix, flowId);
      ErrorHandler.logSystem('RedisFlowRepository', `Flujo '${flowId}' eliminado de Redis (Hash: '${this.keyPrefix}').`);
    } catch (error: any) {
      ErrorHandler.logSystem('RedisFlowRepository', `Error al eliminar flujo '${flowId}' en Redis: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isExternalInstance && this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }
}
