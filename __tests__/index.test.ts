import { jest } from '@jest/globals';

// Mock discord.js before importing main
jest.unstable_mockModule('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    once: jest.fn(),
    on: jest.fn(),
    login: jest.fn().mockResolvedValue('token' as never),
    user: { tag: 'TestBot#1234' },
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
  },
}));

const { main } = await import('../src/index.js');

describe('Application', () => {
  let mockExit: jest.SpiedFunction<typeof process.exit>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set a test token
    process.env['DISCORD_TOKEN'] = 'test-token';
    
    // Mock process.exit
    mockExit = jest
      .spyOn(process, 'exit')
      .mockImplementation((code) => {
        throw new Error(`process.exit called with ${code}`);
      }) as jest.SpiedFunction<typeof process.exit>;
    
    // Mock console.error to suppress error output
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should have a main function', () => {
    expect(typeof main).toBe('function');
  });

  it('should run without errors when token is present', () => {
    expect(() => main()).not.toThrow();
  });

  it('should exit when DISCORD_TOKEN is missing', () => {
    delete process.env['DISCORD_TOKEN'];

    expect(() => main()).toThrow('process.exit called with 1');
  });
});
