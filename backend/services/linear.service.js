/**
 * @module services/linear
 * Linear integration — create issues via the Linear GraphQL API.
 */
import db from '../db/sqlite.js';

/**
 * Internal GraphQL helper — POSTs a query/mutation to the Linear API.
 */
async function linearGraphQL(apiKey, query, variables = {}) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data;
}

/**
 * createLinearIssue — Create a Linear issue and return its URL + ID.
 *
 * Steps:
 * 1. Resolve API key from company_settings (or throw if not configured)
 * 2. Fetch the first team via Linear GraphQL API
 * 3. Create the issue in that team
 * 4. Return { issueId, url, title }
 *
 * @param {object} params
 * @param {string} params.title
 * @param {string} [params.description]
 * @param {string} params.companyId
 * @returns {Promise<{ issueId: string, url: string, title: string }>}
 */
export async function createLinearIssue({ title, description, companyId }) {
  // 1. Resolve API key from company_settings
  const row = db.prepare(
    `SELECT value FROM company_settings WHERE company_id = ? AND key = 'linear_api_key'`
  ).get(companyId);
  if (!row?.value) throw new Error('Linear API key not configured for this company');
  const apiKey = row.value;

  // 2. Fetch the first team
  const teamsData = await linearGraphQL(apiKey, `{ teams { nodes { id name } } }`);
  const teamId = teamsData?.data?.teams?.nodes?.[0]?.id;
  if (!teamId) throw new Error('No Linear teams found — check your Linear workspace and API key');

  // 3. Create the issue
  const mutation = `
    mutation IssueCreate($title: String!, $description: String, $teamId: String!) {
      issueCreate(input: { title: $title, description: $description, teamId: $teamId }) {
        success
        issue { id url title }
      }
    }
  `;
  const issueData = await linearGraphQL(apiKey, mutation, { title, description: description || '', teamId });
  const issue = issueData?.data?.issueCreate?.issue;
  if (!issue) throw new Error('Linear issue creation failed — no issue returned');

  return { issueId: issue.id, url: issue.url, title: issue.title };
}
