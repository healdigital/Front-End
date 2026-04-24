type PayloadLike = {
  find?: (args: Record<string, unknown>) => Promise<{ totalDocs?: number }>;
};

type UserLike = {
  role?: string | null;
};

type RequestLike = {
  user?: unknown;
  payload?: PayloadLike;
};

type AccessArgsLike = {
  req: RequestLike;
};

const getUserRole = (req: RequestLike): string | null => {
  if (!req.user || typeof req.user !== 'object') return null;
  const role = (req.user as UserLike).role;
  return typeof role === 'string' ? role.toLowerCase() : null;
};

const countUsers = async (req: RequestLike): Promise<number> => {
  if (!req.payload?.find) return Number.POSITIVE_INFINITY;

  const result = await req.payload.find({
    collection: 'users',
    limit: 1,
    depth: 0,
    pagination: true,
    overrideAccess: true,
  });

  return Number(result?.totalDocs ?? 0);
};

export const isAdmin = ({ req }: AccessArgsLike): boolean => getUserRole(req) === 'admin';

export const canWriteContent = ({ req }: AccessArgsLike): boolean => {
  const role = getUserRole(req);
  return role === 'admin' || role === 'editor';
};

export const canCreateUser = async ({ req }: AccessArgsLike): Promise<boolean> => {
  if (isAdmin({ req })) return true;
  if (req.user) return false;

  const userCount = await countUsers(req);
  return userCount === 0;
};

export const forceFirstUserAdminRole = async ({
  data,
  operation,
  req,
}: {
  data: Record<string, unknown>;
  operation: string;
  req: RequestLike;
}): Promise<Record<string, unknown>> => {
  if (operation !== 'create') return data;

  const userCount = await countUsers(req);
  if (userCount === 0) {
    return {
      ...data,
      role: 'admin',
    };
  }

  return data;
};
