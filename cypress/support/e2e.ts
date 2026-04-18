// Loaded automatically before every spec file.
import './commands';

// Fail fast on unhandled exceptions in the app under test.
Cypress.on('uncaught:exception', (err) => {
  // Swallow known SignalR reconnection noise so tests don't flake when backend
  // temporarily drops the hub. Everything else should surface as a failure.
  if (/signalr|hub|WebSocket/i.test(err.message)) {
    return false;
  }
  return true;
});
