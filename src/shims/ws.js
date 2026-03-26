// React Native has a native WebSocket implementation.
// This shim replaces the `ws` Node.js package so Supabase realtime
// can be bundled without requiring Node built-ins (events, http, stream).
const W = typeof WebSocket !== 'undefined' ? WebSocket : global.WebSocket;
module.exports = W;
module.exports.default = W;
