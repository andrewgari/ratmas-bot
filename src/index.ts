/**
 * Main entry point for the application
 */
export function main(): void {
  // eslint-disable-next-line no-console
  console.log('Ratmas Bot - Starting...');
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
