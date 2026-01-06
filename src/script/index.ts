import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Config } from '../config.js';
import { run, Events } from '../logic.js';

/**
 * Parse the auth flag from format username:password into separate username and password
 */
function parseAuthFlag(auth: string | undefined): { username?: string; password?: string } {
  if (!auth) return {};
  
  const [username, password] = auth.split(':');
  if (!username || !password) {
    throw new Error('Auth flag must be in format <username>:<password>');
  }
  
  return { username, password };
}

/**
 * Parse command line arguments into a Config object
 */
function parseArgs(argv: string[]): Partial<Config> {
  const yargsInstance = yargs(hideBin(argv))
    .options({
      'nifi-url': {
        type: 'string',
        description: 'URL of the NiFi instance',
        alias: 'u',
      },
      'auth': {
        type: 'string',
        description: 'Credentials in format <username>:<password>',
        alias: 'a',
      },
      'pg-id': {
        type: 'string',
        description: 'Process group ID to analyze',
      },
    })
    .help()
    .alias('help', 'h')
    .example('$0 --nifi-url https://nifi:8080 --auth admin:password', 'Connect to NiFi instance with credentials')
    .example('$0 --pg-id abc-123-def-456', 'Analyze specific process group');

  const args = yargsInstance.parseSync();

  // If help was requested, show it and exit
  if (args.help) {
    yargsInstance.showHelp();
    process.exit(0);
  }

  const { auth } = args;
  const authConfig = parseAuthFlag(auth);

  const config: Partial<Config> = {};
  
  if (args['nifi-url']) config.nifiUrl = args['nifi-url'];
  if (authConfig.username) config.nifiUsername = authConfig.username;
  if (authConfig.password) config.nifiPassword = authConfig.password;
  if (args['pg-id']) config.pgId = args['pg-id'];
  
  return config;
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Run the main function
async function main() {
  try {
    const config = parseArgs(process.argv);
    
    const events: Events = {
      onMessage: (message) => console.log(message.content),
      onSuccess: () => {},
      onFail: (error) => console.error('❌ Error:', error)
    };
    
    await run(config, events);
  } catch (error) {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  }
}

main();


