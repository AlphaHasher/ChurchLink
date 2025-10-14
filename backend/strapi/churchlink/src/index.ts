import type { Core } from '@strapi/strapi';

type BootstrapEnv = {
  STRAPI_ADMIN_EMAIL?: string;
  STRAPI_ADMIN_FIRSTNAME?: string;
  STRAPI_ADMIN_LASTNAME?: string;
  STRAPI_ADMIN_PASSWORD?: string;
};


function assertEnv(env: BootstrapEnv) {
  const missing = [];
  if (!env.STRAPI_ADMIN_EMAIL) missing.push('STRAPI_ADMIN_EMAIL');
  if (!env.STRAPI_ADMIN_PASSWORD) missing.push('STRAPI_ADMIN_PASSWORD');
  if (missing.length) throw new Error(`[bootstrap] Missing env: ${missing.join(', ')}`);
}

async function ensureSuperAdmin(strapi: Core.Strapi, env: BootstrapEnv) {
  const adminCount = await strapi.db.query('admin::user').count({ where: {} });
  if (adminCount > 0) {
    strapi.log.info('[bootstrap] Admin user detected — skipping auto-create.');
    return;
  }

  assertEnv(env);

  const email = env.STRAPI_ADMIN_EMAIL!.trim().toLowerCase();
  const firstname = (env.STRAPI_ADMIN_FIRSTNAME ?? 'Admin').trim();
  const lastname = (env.STRAPI_ADMIN_LASTNAME ?? 'User').trim();
  const rawPassword = env.STRAPI_ADMIN_PASSWORD!;

  const superAdminRole = await strapi.service('admin::role').getSuperAdmin();

  const created = await strapi.service('admin::user').create({
    email,
    firstname,
    lastname,
    password: rawPassword,
    isActive: true,
    blocked: false,
    registrationToken: null,
    roles: [superAdminRole.id],
  });

  strapi.log.info(`[bootstrap] ✅ Super Admin created: ${email}`);

  const ok = await strapi.service('admin::auth').validatePassword(rawPassword, created.password);
  strapi.log.info(`[bootstrap] Password validation for ${email}: ${ok ? 'OK' : 'FAILED'}`);
  if (!ok) strapi.log.warn('[bootstrap] Password Hash mismatch!');
}

type RoleSpec = {
  name: string;
  code: string;
  description: string;
  actionPatterns: string[];
};

async function getAllAdminActionUIDs(strapi: Core.Strapi): Promise<string[]> {
  const out = new Set<string>();

  try {
    const svcAny: any = (strapi as any).service?.('admin::permission');
    const provider = svcAny?.actionProvider;
    if (provider) {
      const candidates: any[] = [];
      if (typeof provider.values === 'function') {
        const vals = provider.values();
        if (Array.isArray(vals)) candidates.push(...vals);
        else candidates.push(...Object.values(vals).flat());
      } else if (typeof provider.getAll === 'function') {
        const all = provider.getAll();
        candidates.push(...Object.values(all).flat());
      } else if (Array.isArray(provider)) {
        candidates.push(...provider);
      }
      for (const c of candidates) {
        if (typeof c === 'string') out.add(c);
        else if (c && typeof c.action === 'string') out.add(c.action);
      }
    }
  } catch {
  }

  [
    'plugin::upload.read',
    'plugin::upload.configure-view',
    'plugin::upload.assets.create',
    'plugin::upload.assets.update',
    'plugin::upload.assets.delete',
    'plugin::upload.assets.download',
    'plugin::upload.assets.copy-link',
    'plugin::upload.settings.read',
    'plugin::upload.settings.update',
  ].forEach((a) => out.add(a));

  return [...out].filter((s): s is string => typeof s === 'string' && s.length > 0);
}

function resolveActions(all: string[], patterns: string[]): string[] {
  const set = new Set<string>();
  const safeAll = all.filter((s) => typeof s === 'string' && s.length > 0);

  for (const uid of safeAll) {
    for (const p of patterns) {
      if (!p || typeof p !== 'string') continue;
      if (uid === p || uid.endsWith(p)) set.add(uid);
    }
  }
  for (const p of patterns) {
    if (typeof p === 'string' && p.includes('::')) set.add(p);
  }
  return [...set];
}

async function ensureAdminRoleAdditive(strapi: Core.Strapi, spec: RoleSpec) {
  const roleRepo = strapi.db.query('admin::role');
  const permRepo = strapi.db.query('admin::permission');
  const linkTable = 'admin_permissions_role_lnk';
  const knex = (strapi.db as any).connection as import('knex').Knex;

  let role = await roleRepo.findOne({ where: { code: spec.code } });
  if (!role) {
    role = await roleRepo.create({
      data: { name: spec.name, code: spec.code, description: spec.description },
    });
    strapi.log.info(`[rbac] Created admin role '${spec.name}'`);
  } else {
    await roleRepo.update({
      where: { id: role.id },
      data: { name: spec.name, description: spec.description },
    });
  }

  const allActionUIDs = await getAllAdminActionUIDs(strapi);
  const desired = resolveActions(allActionUIDs, spec.actionPatterns);

  let addedLinks = 0;
  for (const action of desired) {
    let perm = await permRepo.findOne({ where: { action } });
    if (!perm) {
      perm = await permRepo.create({
        data: { action, subject: null, properties: {}, conditions: [] },
      });
    }

    const exists = await knex(linkTable)
      .where({ role_id: role.id, permission_id: perm.id })
      .first();

    if (!exists) {
      await knex(linkTable).insert({ role_id: role.id, permission_id: perm.id });
      addedLinks += 1;
    }
  }

  strapi.log.info(
    `[rbac] Role '${spec.name}': ensured ${desired.length} permission(s); added ${addedLinks} missing link(s).`
  );
}

async function ensureCustomAdminRoles(strapi: Core.Strapi) {
  const roles: RoleSpec[] = [
    {
      name: 'default-role',
      code: 'default-role',
      description: 'Default admin role with read-only Media Library access.',
      actionPatterns: [
        'plugin::upload.read',
        'plugin::upload.assets.download',
        'plugin::upload.assets.copy-link',
      ],
    },
    {
      name: 'media-management',
      code: 'media-management',
      description: 'Admin role for managing media and its settings.',
      actionPatterns: [
        'plugin::upload.read',
        'plugin::upload.configure-view',
        'plugin::upload.assets.create',
        'plugin::upload.assets.update',
        'plugin::upload.assets.delete',
        'plugin::upload.assets.download',
        'plugin::upload.assets.copy-link',
        'plugin::upload.settings.read',
      ],
    },
  ];

  for (const spec of roles) {
    await ensureAdminRoleAdditive(strapi, spec);
  }
}

export default {
  register() { },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureSuperAdmin(strapi, process.env as BootstrapEnv);
    await ensureCustomAdminRoles(strapi);
  },
};
