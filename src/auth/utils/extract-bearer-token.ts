export function extractBearerToken(authorization?: string | string[]) {
  if (!authorization || Array.isArray(authorization)) return undefined;

  const [type, token] = authorization.split(' ');
  return type === 'Bearer' ? token : undefined;
}
