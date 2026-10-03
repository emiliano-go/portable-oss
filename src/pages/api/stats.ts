import type { APIRoute } from 'astro';
import { getConfig } from '../../lib/config';
import { getStats } from '../../lib/stats';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const config = getConfig();
  const profile = url.searchParams.get('profile') === '1';

  const requestedParam = url.searchParams.get('projects');
  const requested = requestedParam
    ? requestedParam.split(',').map((key) => key.trim()).filter(Boolean)
    : config.projects.map((project) => project.key);

  const unknown = requested.filter((key) => !config.byKey[key]);
  const projects = requested.filter((key) => Boolean(config.byKey[key]));

  const orgsParam = url.searchParams.get('orgs');
  const orgs = orgsParam
    ? orgsParam
        .split(',')
        .map((login) => login.trim())
        .filter(Boolean)
        .filter((login) => config.orgs.some((org) => org.login.toLowerCase() === login.toLowerCase()))
    : [];

  const data = await getStats({ profile, orgs, projects });
  if (unknown.length) data.errors.push(...unknown.map((key) => `unknown project: ${key}`));

  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60',
    },
  });
};
