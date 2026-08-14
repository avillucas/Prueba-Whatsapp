import * as fs from 'fs';
import { JsonFlowAdapter } from './JsonFlowAdapter';

jest.mock('fs');

describe('JsonFlowAdapter', () => {
  it('should throw error if file does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    expect(() => new JsonFlowAdapter('non-existent.json')).toThrow("El archivo de flujo JSON no existe: non-existent.json");
  });

  it('should load flow from valid JSON file', () => {
    const mockNodes = [{ id: 'NODE_1', text: 'Hello', options: [] }];
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockNodes));

    const adapter = new JsonFlowAdapter('existent.json');
    expect(adapter.getFlow()).toEqual(mockNodes);
    expect(adapter.getInitialNodeId()).toBe('MSG_INICIAL');
  });

  it('should allow custom initial node id', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("[]");

    const adapter = new JsonFlowAdapter('existent.json', 'CUSTOM_INITIAL');
    expect(adapter.getInitialNodeId()).toBe('CUSTOM_INITIAL');
  });
});
