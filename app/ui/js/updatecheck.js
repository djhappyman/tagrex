// This personal fork has no update service yet. Keep the controller API inert
// so startup and older callers cannot schedule or request upstream updates.
export function initUpdateCheck() {}
export async function checkUpdateNow() {}
