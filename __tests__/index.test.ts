/* eslint-disable @typescript-eslint/ban-ts-comment */
import { jest } from '@jest/globals';

// Mock discord.js before importing main
jest.unstable_mockModule('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    once: jest.fn(),
    on: jest.fn(),
    // @ts-expect-error
    login: jest.fn().mockResolvedValue('token'),
    user: { tag: 'TestBot#1234' },
    application: {
      commands: {
        // @ts-expect-error
        fetch: jest.fn().mockResolvedValue(new Map()),
        // @ts-expect-error
        create: jest.fn().mockResolvedValue({ id: 'command-id', name: 'ratmas' }),
      },
    },
    guilds: {
      // @ts-expect-error
      fetch: jest.fn().mockResolvedValue({
        channels: {
          // @ts-expect-error
          create: jest.fn().mockResolvedValue({
            id: 'mock-channel-id',
            name: 'mock-channel',
          }),
          // @ts-expect-error
          fetch: jest.fn().mockResolvedValue(new Map()),
        },
      }),
    },
    channels: {
      // @ts-expect-error
      fetch: jest.fn().mockResolvedValue({
        permissionOverwrites: {
          // @ts-expect-error
          edit: jest.fn().mockResolvedValue(undefined),
        },
      }),
    },
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
    GuildMembers: 8,
  },
  ChannelType: {
    GuildText: 0,
    GuildVoice: 2,
    GuildCategory: 4,
    GuildAnnouncement: 5,
    GuildStageVoice: 13,
  },
  PermissionFlagsBits: {
    ViewChannel: 1024n,
    SendMessages: 2048n,
    ReadMessageHistory: 65536n,
    ManageMessages: 8192n,
    EmbedLinks: 16384n,
    AttachFiles: 32768n,
    AddReactions: 64n,
    UseExternalEmojis: 262144n,
    MentionEveryone: 131072n,
    ManageChannels: 16n,
    ManageRoles: 268435456n,
    Connect: 1048576n,
    Speak: 2097152n,
    Administrator: 8n,
  },
  PermissionsBitField: jest.fn().mockImplementation(() => ({
    has: jest.fn().mockReturnValue(true),
  })),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
  })),
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setDefaultMemberPermissions: jest.fn().mockReturnThis(),
    addSubcommand: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({}),
  })),
  SlashCommandSubcommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({}),
  })),
  ModalBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    addComponents: jest.fn().mockReturnThis(),
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis(),
  })),
  TextInputBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setRequired: jest.fn().mockReturnThis(),
  })),
  TextInputStyle: {
    Short: 1,
    Paragraph: 2,
  },
  ButtonBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
  })),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5,
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
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    }) as jest.SpiedFunction<typeof process.exit>;

    // Mock console.error to suppress error output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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
